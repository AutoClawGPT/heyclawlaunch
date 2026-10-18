import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import { ctxForUser, type Ctx } from "@/lib/core/ctx";
import { runAgent, executePending, type ChatMsg } from "@/lib/brain/agent";
import { runTool } from "@/lib/tools/run";
import { pinLogoBytes } from "@/lib/core/logo";
import { prepareLaunch } from "@/lib/core/drafts";
import { createPending } from "@/lib/brain/agent";
import { getOrCreateCustodial } from "@/lib/keystore";
import { generateLogo, generateIdea, logoPrompt } from "@/lib/image-gen";
import { registerCommands, COMMANDS } from "@/lib/bots/tg-commands";
export { COMMANDS };

type Thread = { messages: ChatMsg[]; draftId: string | null; awaitPrompt?: boolean; lastPrompt?: string };
const threads = new Map<string, Thread>();
const key = (c: Context) => `${c.chat?.id}:${c.from?.id}`;
const thread = (c: Context) => { const k = key(c); if (!threads.has(k)) threads.set(k, { messages: [], draftId: null }); return threads.get(k)!; };

/** Telegram identity: linked site account (SIWS/X) if linked, else this Telegram user's own wallet (tg:<id>). Telegram user ids are authenticated by Telegram. */
export async function tgCtx(fromId: number): Promise<Ctx> {
  const [u] = await sql`select * from users where telegram_id=${String(fromId)}`;
  const base: Ctx = u ? { ...ctxForUser(u as any, "telegram") } : { ownerKey: `tg:${fromId}`, walletKey: `tg:${fromId}`, surface: "telegram" };
  const [p] = await sql`select mode from tg_wallet_prefs where telegram_id=${String(fromId)}`.catch(() => []);
  if (p?.mode === "imported") { const [w] = await sql`select 1 from custodial_wallets where owner_key=${`tgimp:${fromId}`}`; if (w) return { ...base, walletKey: `tgimp:${fromId}` }; }
  return base;
}

/** Logo keyboard shown when the bot asks for the logo. Callback data carries the requester's Telegram id: only they can press. */
export const logoKb = (uid: number, hasLogo = false) => { const k = new InlineKeyboard().text("📤 Upload image", `u:${uid}`).text("✨ Generate with AI", `g:${uid}`); if (hasLogo) k.row().text("🔄 Regenerate", `r:${uid}`); return k; };
async function draftOf(ctx: Ctx, id: string | null) { if (!id) return null; const [d] = await sql`select * from drafts where id=${id} and owner_key=${ctx.ownerKey}`; return d ?? null; }
/** Generate a logo for the user's draft (from a prompt, or from the coin name + description). */
export async function botGenLogo(ctx: Ctx, th: Thread, prompt?: string) {
  const d = await draftOf(ctx, th.draftId);
  const subject = prompt ?? (d?.name ? `${d.name}${d.ticker ? ` ($${d.ticker})` : ""}${d.description ? `: ${d.description}` : ""}` : "a friendly robot mascot");
  th.lastPrompt = subject;
  const g = await generateLogo(logoPrompt(subject));
  const r = await prepareLaunch(ctx, { draft_id: d?.id, logo_image: g.url }); th.draftId = r.draft.id;
  th.messages.push({ role: "assistant", content: `[Generated the logo with AI and set it: ${g.url}]\n${r.text}` });
  return { bytes: g.bytes, url: g.url, text: r.text, ready: r.ready, draftId: r.draft.id };
}
/** One-tap quick launch: AI name/ticker/description/logo, fees to the user's own HeyClawLaunch wallet, SOL pair. Returns a confirm_launch pending action; nothing launches until the user taps Confirm. */
export async function botQuick(ctx: Ctx, th: Thread, theme?: string) {
  const idea = await generateIdea(theme);
  const g = await generateLogo(logoPrompt(`${idea.name} ($${idea.ticker}): ${idea.description}`));
  const wallet = await getOrCreateCustodial(ctx.walletKey ?? ctx.ownerKey);
  const r = await prepareLaunch(ctx, { start_new: true, name: idea.name, ticker: idea.ticker, description: idea.description, logo_image: g.url, fee_mode: "wallet", fee_wallet: wallet, pair: "SOL", skip_socials: true });
  th.draftId = r.draft.id; th.lastPrompt = `${idea.name} ($${idea.ticker}): ${idea.description}`;
  const caption = `${idea.name} ($${idea.ticker})\n${idea.description}\n\nFees: 80% to your ${cfg.brand} wallet ${wallet}\nPair: SOL · no dev buy · 0 SOL\n\nTap Confirm to launch it on pump.fun (permanent).`;
  th.messages.push({ role: "assistant", content: `[Quick launch prepared]\n${caption}` });
  if (!r.ready) return { bytes: g.bytes, caption: `${caption}\n\n${r.text}`, pending: null, idea, draftId: r.draft.id };
  const pending = await createPending(ctx, "confirm_launch", { draft_id: r.draft.id });
  return { bytes: g.bytes, caption, pending, idea, draftId: r.draft.id };
}
async function sendQuick(c: Context, theme?: string) {
  const ctx = await tgCtx(c.from!.id); const th = thread(c); const uid = c.from!.id;
  await c.reply(`✨ Inventing your coin${theme ? ` (${theme})` : ""}… (about 10–30 s)`);
  await c.replyWithChatAction("upload_photo").catch(() => {});
  try {
    const q = await botQuick(ctx, th, theme);
    const kb = q.pending ? new InlineKeyboard().text("✅ Confirm launch", `c:${q.pending.id}`).text("Cancel", `x:${q.pending.id}`).row().text("🔄 New idea", `q:${uid}`).text("🎨 New logo", `rq:${uid}`) : undefined;
    await c.replyWithPhoto(new InputFile(Buffer.from(q.bytes), "logo.png"), { caption: q.caption.slice(0, 1000), reply_markup: kb });
  } catch (e: any) { await c.reply(`Couldn't generate it: ${String(e.message).slice(0, 200)}`); }
}
function chunks(t: string) { const out = []; for (let i = 0; i < t.length; i += 3900) out.push(t.slice(i, i + 3900)); return out.length ? out : ["…"]; }

async function converse(c: Context, text: string) {
  const th = thread(c); const ctx = await tgCtx(c.from!.id);
  th.messages.push({ role: "user", content: text });
  await c.replyWithChatAction("typing").catch(() => {});
  try {
    const r = await runAgent(ctx, th.messages, { draftId: th.draftId, extraSystem: "You are chatting on Telegram: plain text, no markdown tables. The user can attach a photo as the logo." });
    th.draftId = r.draftId ?? th.draftId;
    th.messages.push({ role: "assistant", content: r.reply }); th.messages = th.messages.slice(-30);
    const parts = chunks(r.reply);
    for (let i = 0; i < parts.length; i++) {
      let kb: InlineKeyboard | undefined = i === parts.length - 1 && r.pending ? new InlineKeyboard().text("✅ Confirm", `c:${r.pending.id}`).text("Cancel", `x:${r.pending.id}`) : undefined;
      if (!kb && i === parts.length - 1) { const d = await draftOf(ctx, th.draftId); if (d && d.name && d.ticker && !d.logo_cid && /logo|image/i.test(r.reply)) kb = logoKb(c.from!.id); }
      await c.reply(parts[i], { reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  } catch (e: any) { console.error(e); await c.reply("Sorry, something went wrong. Try again."); }
}

export function buildBot(token = process.env.TELEGRAM_BOT_TOKEN!) {
  const bot = new Bot(token);
  bot.command("start", async c => {
    const arg = c.match?.trim();
    if (arg && arg.startsWith("link_")) {
      const [l] = await sql`update telegram_links set used_at=now(), telegram_id=${String(c.from!.id)} where token=${arg.slice(5)} and used_at is null and expires_at>now() returning *`;
      return c.reply(l ? "Linked! Finish on the website tab to attach this Telegram account to your wallet." : "That link expired. Use /link again.");
    }
    threads.delete(key(c));
    await c.reply(`Hi! I'm ${cfg.brand}. I launch pump.fun coins for you — no wallet, no signing, no dev buy (${cfg.cluster}).\n\nSay "launch a coin" to start, or tap Quick launch and I'll invent the whole coin (name, ticker, logo) for you. Also /templates, /wallet, /bots, /leaderboard, /help for everything.`, { reply_markup: new InlineKeyboard().text("⚡ Quick launch", `q:${c.from!.id}`).text("🚀 Launch step by step", `s:${c.from!.id}`) });
  });
  bot.command("launch", c => { threads.delete(key(c)); return converse(c, "I want to launch a new coin" + (c.match ? `: ${c.match}` : "")); });
  bot.command("withdraw", c => converse(c, `I want to withdraw ${c.match ?? ""}`.trim()));
  bot.command("swap", c => converse(c, `I want to swap ${c.match ?? ""}`.trim()));
  bot.command("pairs", async c => { const r = await runTool(await tgCtx(c.from!.id), "list_pairs", {}); for (const p of chunks(r.text)) await c.reply(p); });
  bot.command("quick", c => sendQuick(c, (c.match as string)?.trim() || undefined));
  bot.command("new", c => { threads.delete(key(c)); return c.reply("Conversation reset."); });
  bot.command("link", async c => {
    const t = randomBytes(12).toString("base64url");
    await sql`insert into telegram_links(token,telegram_id,expires_at) values(${t},${String(c.from!.id)},now()+interval '15 minutes')`;
    await c.reply(`Open this link while signed in on the website (wallet or X) to link this Telegram account to it (valid 15 min):\n${cfg.appUrl}/link/telegram?token=${t}`, { link_preview_options: { is_disabled: true } });
  });
  registerCommands(bot, { converse, draftId: c => thread(c).draftId, setDraft: (c, id) => { const th = thread(c); th.draftId = id; th.messages.push({ role: "assistant", content: `[Template draft ${id} prepared; waiting for Confirm]` }); } });
  bot.on("callback_query:data", async (c, next) => {
    const [kind, arg] = c.callbackQuery.data.split(":");
    if (!["u", "g", "gn", "r", "q", "rq", "s"].includes(kind)) return next();
    if (String(c.from.id) !== arg) return c.answerCallbackQuery({ text: "Only the person who asked can use these buttons.", show_alert: true });
    const ctx = await tgCtx(c.from.id); const th = thread(c);
    await c.answerCallbackQuery();
    if (kind === "u") return c.reply("Send the logo as a photo (PNG/JPEG/WEBP, max 5 MB).");
    if (kind === "s") { threads.delete(key(c)); return converse(c, "I want to launch a new coin"); }
    if (kind === "q") return sendQuick(c);
    if (kind === "g") { th.awaitPrompt = true; return c.reply("Describe the logo in a few words (e.g. \"a cat astronaut\"), or tap below to use the coin's name and description.", { reply_markup: new InlineKeyboard().text("Use the coin name", `gn:${c.from.id}`) }); }
    if (kind === "rq") { // new logo for the quick-launch draft, keep the pending confirm valid (same draft)
      await c.replyWithChatAction("upload_photo").catch(() => {});
      try { const g = await botGenLogo(ctx, th, th.lastPrompt); const pend = g.ready ? await createPending(ctx, "confirm_launch", { draft_id: g.draftId }) : null;
        await c.replyWithPhoto(new InputFile(Buffer.from(g.bytes), "logo.png"), { caption: pend ? "New logo set. Tap Confirm to launch." : g.text.slice(0, 1000), reply_markup: pend ? new InlineKeyboard().text("✅ Confirm launch", `c:${pend.id}`).text("Cancel", `x:${pend.id}`).row().text("🎨 New logo", `rq:${c.from.id}`) : undefined }); }
      catch (e: any) { await c.reply(`Couldn't generate it: ${String(e.message).slice(0, 200)}`); }
      return;
    }
    th.awaitPrompt = false; await c.replyWithChatAction("upload_photo").catch(() => {});
    try { const g = await botGenLogo(ctx, th, kind === "r" ? th.lastPrompt : undefined);
      await c.replyWithPhoto(new InputFile(Buffer.from(g.bytes), "logo.png"), { caption: `Logo set ✅\n\n${g.text}`.slice(0, 1000), reply_markup: new InlineKeyboard().text("🔄 Regenerate", `r:${c.from.id}`).text("📤 Upload instead", `u:${c.from.id}`) }); }
    catch (e: any) { await c.reply(`Couldn't generate it: ${String(e.message).slice(0, 200)}`); }
  });
  bot.on("callback_query:data", async c => {
    const [kind, id] = c.callbackQuery.data.split(":");
    const ctx = await tgCtx(c.from.id);
    const [p] = await sql`select owner_key from pending_actions where id=${id}`;
    if (!p || p.owner_key !== ctx.ownerKey) return c.answerCallbackQuery({ text: "Only the person who asked can confirm this.", show_alert: true });
    if (kind === "x") { await sql`update pending_actions set used_at=now() where id=${id} and used_at is null`; await c.answerCallbackQuery({ text: "Cancelled" }); return c.editMessageReplyMarkup().catch(() => {}); }
    await c.answerCallbackQuery({ text: "Working on it…" }); await c.editMessageReplyMarkup().catch(() => {});
    const r = await executePending(ctx, id);
    const text = "error" in r ? r.error : r.out.text;
    const th = threads.get(`${c.chat?.id}:${c.from.id}`); th?.messages.push({ role: "assistant", content: text });
    for (const part of chunks(text)) await c.reply(part, { link_preview_options: { is_disabled: true } });
  });
  bot.on("message:photo", async c => {
    try {
      const ph = c.message.photo[c.message.photo.length - 1];
      const f = await c.api.getFile(ph.file_id);
      const buf = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`)).arrayBuffer());
      const cid = await pinLogoBytes(buf);
      await converse(c, `${c.message.caption ?? ""}\n[I attached the logo image: ipfs://${cid} — pass it as logo_url]`.trim());
    } catch (e: any) { await c.reply(`Couldn't use that image: ${e.message}`); }
  });
  bot.on("message:text", async c => {
    if (c.chat.type !== "private" && !c.message.text.includes(`@${c.me.username}`)) return;
    const th = thread(c);
    if (th.awaitPrompt) { th.awaitPrompt = false; await c.replyWithChatAction("upload_photo").catch(() => {});
      try { const g = await botGenLogo(await tgCtx(c.from.id), th, c.message.text.trim()); await c.replyWithPhoto(new InputFile(Buffer.from(g.bytes), "logo.png"), { caption: `Logo set ✅\n\n${g.text}`.slice(0, 1000), reply_markup: new InlineKeyboard().text("🔄 Regenerate", `r:${c.from.id}`).text("📤 Upload instead", `u:${c.from.id}`) }); }
      catch (e: any) { await c.reply(`Couldn't generate it: ${String(e.message).slice(0, 200)}`); }
      return; }
    await converse(c, c.message.text.replace(`@${c.me.username}`, "").trim());
  });
  bot.catch(e => console.error("bot error", e.error));
  return bot;
}
