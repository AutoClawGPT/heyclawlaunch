// Deterministic Telegram commands (no LLM round-trip): templates, wallet, bots, leaderboard, airdrops, key export.
import { Bot, InlineKeyboard, type Context } from "grammy";
import bs58 from "bs58";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { cfg, solscanTx } from "@/lib/config";
import { conn } from "@/lib/solana";
import { createPending } from "@/lib/brain/agent";
import { getOrCreateCustodial, withCustodialSigner, importKeypair, findCustodial } from "@/lib/keystore";
import { Keypair } from "@solana/web3.js";
import { listTemplates, draftFromTemplate } from "@/lib/core/templates";
import { myWallet, claimFees } from "@/lib/core/wallet";
import { KINDS, orderBot, myBotOrders, botMarkets, type Kind } from "@/lib/core/bots";
import { leaderboard, label, nextReset, airdropHistory, PRIZES, volumeStats } from "@/lib/core/leaderboard";
import { coinInfo } from "@/lib/core/coin";
import { listCoins, fmtQ } from "@/lib/core/market";
import { hasRedis } from "@/lib/redis";
import { tgCtx } from "@/lib/bots/telegram";

const sol = (l: number | bigint) => (Number(l) / LAMPORTS_PER_SOL).toLocaleString("en-US", { maximumFractionDigits: 4 });
const err = (e: any) => String(e?.message ?? e).slice(0, 600);
const NOLINK = { link_preview_options: { is_disabled: true } } as const;
const until = (iso: string) => { const s = Math.max(0, (+new Date(iso) - Date.now()) / 1000); return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; };
const botSel = new Map<number, { mint?: string; kind?: Kind }>();
const awaitingKey = new Set<number>();
function parseSecret(t: string): Keypair | null { try { const s = t.trim(); const b = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s); return b.length === 64 ? Keypair.fromSecretKey(b) : b.length === 32 ? Keypair.fromSeed(b) : null; } catch { return null; } }

export const COMMANDS = [
  ["start", "Start / main menu"], ["launch", "Launch a coin step by step"], ["quick", "Quick launch: AI invents the whole coin"],
  ["templates", "One-tap launch from a template"], ["preview", "Preview the coin you're building"], ["wallet", "Your wallet, balances and fees"],
  ["deposit", "Your deposit address"], ["balance", "SOL balance"], ["claim", "Claim creator fees"], ["claimall", "Claim fees from every coin"],
  ["withdraw", "Withdraw SOL or tokens"], ["swap", "Buy / sell tokens"], ["mylaunches", "Coins you launched"], ["token", "Token info: /token <mint>"],
  ["leaderboard", "Volume leaderboard"], ["airdrops", "Airdrop prizes and history"], ["bots", "Volume bots: buy a package"], ["volume", "Volume bots (alias)"],
  ["mybots", "Your bot orders"], ["exportkey", "Export your private key (DM only)"], ["importwallet", "Import your own wallet (DM only)"], ["usewallet", "Choose custodial or imported wallet"], ["payout", "Set a read-only payout address"], ["settings", "Settings"], ["pairs", "Pair assets"],
  ["feed", "Community feed"], ["post", "Post to the community: /post <text>"], ["agents", "Top AI agents"], ["scan", "Scan a wallet: /scan <address>"],
  ["link", "Link Telegram to your web account"], ["new", "Reset the conversation"], ["help", "All commands"],
] as const;

export function registerCommands(bot: Bot, h: { converse: (c: Context, t: string) => Promise<void>; draftId: (c: Context) => string | null; setDraft: (c: Context, id: string) => void }) {
  bot.command("help", c => c.reply(`${cfg.brand} commands (${cfg.cluster}):\n\n` + COMMANDS.map(([k, d]) => `/${k} — ${d}`).join("\n")));
  bot.command("settings", c => c.reply(`Settings\n• Fees: 80% of creator fees go to the coin's fee recipient, 20% to ${cfg.brand}.\n• Claim minimum: 0.00065024 SOL.\n• Network: ${cfg.cluster}\n• Web settings: ${cfg.appUrl}/settings`, { ...NOLINK, reply_markup: new InlineKeyboard().text("🔑 Export private key", `ek:${c.from!.id}`).row().text("👛 Wallet", `wl:${c.from!.id}`) }));
  bot.command(["deposit", "balance"], async c => {
    const ctx = await tgCtx(c.from!.id); const a = await getOrCreateCustodial(ctx.walletKey!);
    const b = await conn().getBalance(new PublicKey(a));
    await c.reply(`Your ${cfg.brand} wallet (${cfg.cluster}):\n${a}\nBalance: ${sol(b)} SOL\n\nSend devnet SOL to this address to fund launches, swaps and bots.`, NOLINK);
  });
  bot.command("wallet", async c => { try { await c.reply(await myWallet(await tgCtx(c.from!.id)), NOLINK); } catch (e) { await c.reply(err(e)); } });
  bot.command(["claim", "claimall"], async c => { await c.reply("Claiming your creator fees…"); try { await c.reply(await claimFees(await tgCtx(c.from!.id)), NOLINK); } catch (e) { await c.reply(err(e)); } });
  bot.command("mylaunches", async c => {
    const ctx = await tgCtx(c.from!.id);
    const r = await sql`select mint,name,ticker,launched_at,split_status from launches where owner_key=${ctx.ownerKey} and mint is not null order by launched_at desc limit 20`;
    if (!r.length) return c.reply("You haven't launched a coin yet. Try /quick or /templates.");
    await c.reply(r.map((x: any) => `$${x.ticker} · ${x.name}\n${cfg.appUrl}/token/${x.mint}`).join("\n\n"), NOLINK);
  });
  bot.command("token", async c => {
    const m = String(c.match ?? "").trim(); if (!m) return c.reply("Usage: /token <mint address>");
    try { new PublicKey(m); } catch { return c.reply("That isn't a valid mint address."); }
    const [l] = await sql`select name,ticker,fee_label,launched_at from launches where mint=${m}`;
    if (!l) return c.reply(`That coin wasn't launched on ${cfg.brand}.`);
    const ci: any = await coinInfo(m).catch(() => null); const v = await volumeStats(m).catch(() => null);
    await c.reply(`$${l.ticker} · ${l.name}\nmint ${m}\nfees: ${l.fee_label ?? "—"}\n${ci?.curve ? `curve: ${ci.curve.complete ? "graduated" : `${(ci.curve.progress ?? 0).toFixed?.(1) ?? ci.curve.progress}%`}\n` : ""}${v ? `24h volume: ${(v as any).v24?.toFixed?.(3) ?? 0} SOL\n` : ""}${cfg.appUrl}/token/${m}`, { ...NOLINK, reply_markup: new InlineKeyboard().text("🤖 Boost with bots", `bm:${c.from!.id}:${m}`) });
  });
  bot.command("preview", async c => {
    const id = h.draftId(c); const ctx = await tgCtx(c.from!.id);
    const [d] = id ? await sql`select * from drafts where id=${id} and owner_key=${ctx.ownerKey}` : [];
    if (!d) return c.reply("No coin in progress. Start with /launch, /quick or /templates.");
    const card = `PREVIEW\nName: ${d.name ?? "—"}\nTicker: ${d.ticker ? "$" + d.ticker : "—"}\nDescription: ${d.description ?? "—"}\nLogo: ${d.logo_cid ? "set ✅" : "missing"}\nFees: ${d.fee_mode === "wallet" ? `wallet ${d.fee_wallet}` : d.fee_mode === "x" ? `@${d.fee_x_handle}` : d.fee_mode ?? "—"} (80% to recipient · 20% platform)\nPair: ${d.pair_symbol ?? "SOL"} · no dev buy · 0 SOL`;
    const ready = d.name && d.ticker && d.logo_cid;
    if (!ready) return c.reply(card + "\n\nStill missing details — just reply with them.");
    const p = await createPending(ctx, "confirm_launch", { draft_id: d.id });
    const kb = new InlineKeyboard().text("✅ Confirm launch", `c:${p.id}`).text("Cancel", `x:${p.id}`);
    if (d.logo_cid) await c.replyWithPhoto(`https://${process.env.PINATA_GATEWAY ?? "ipfs.io"}/ipfs/${d.logo_cid}`, { caption: card.slice(0, 1000), reply_markup: kb }).catch(() => c.reply(card, { reply_markup: kb }));
    else await c.reply(card, { reply_markup: kb });
  });
  bot.command("templates", async c => {
    const ts = await listTemplates(); if (!ts.length) return c.reply("No templates yet.");
    const kb = new InlineKeyboard(); ts.slice(0, 20).forEach((t, i) => { kb.text(`$${t.ticker}`, `tp:${c.from!.id}:${t.id}`); if (i % 3 === 2) kb.row(); });
    await c.reply(`Pick a template — one tap prepares the coin from your own wallet (80% of fees to you). You confirm before anything launches.\n\n${ts.slice(0, 20).map(t => `$${t.ticker} — ${t.name}`).join("\n")}`, { reply_markup: kb });
  });
  bot.command("feed", async c => {
    const { feed } = await import("@/lib/core/social"); const ps = await feed({ limit: 8 });
    await c.reply(ps.length ? `🗣 Community\n\n${ps.map((p: any) => `#${p.id} ${p.author?.name ?? "?"}${p.kind === "call" ? ` [${p.call?.side?.toUpperCase()} ${p.call?.ticker ? "$" + p.call.ticker : ""}]` : ""}: ${(p.repost_of && !p.body ? "↻ " + p.repost_of.body : p.body).slice(0, 160)}  ♥${p.likes}`).join("\n\n")}\n\n${cfg.appUrl}/community` : `No posts yet. /post <text> to start.\n${cfg.appUrl}/community`, NOLINK);
  });
  bot.command("post", async c => {
    const t = String(c.match ?? "").trim(); if (!t) return c.reply("Usage: /post <text> (max 500 characters)");
    const { createPost } = await import("@/lib/core/social"); const k = `tg:${c.from!.id}`;
    try { const r: any = await createPost({ ownerKey: k, walletKey: k, surface: "telegram" }, { body: t }); await c.reply(`Posted #${r.id}: ${r.url}`, NOLINK); } catch (e: any) { await c.reply(e.message); }
  });
  bot.command("agents", async c => {
    const { listAgents } = await import("@/lib/core/agents"); const as = await listAgents("volume", 10);
    await c.reply(as.length ? `🤖 Top agents\n\n${as.map((a: any, i: number) => `${i + 1}. ${a.name} @${a.handle}${a.verified ? " ✓" : ""} — ${a.volume_sol.toFixed(3)} SOL vol · ${a.followers} followers`).join("\n")}\n\nRegister yours: ${cfg.appUrl}/skill.md` : `No agents yet. Register one: ${cfg.appUrl}/skill.md`, NOLINK);
  });
  bot.command("scan", async c => {
    const w = String(c.match ?? "").trim(); if (!w) return c.reply("Usage: /scan <wallet address>");
    const { scanWallet } = await import("@/lib/core/claims");
    try { const d = await scanWallet(w); await c.reply(`🔎 ${w.slice(0, 4)}…${w.slice(-4)}\nLaunched: ${d.totals.launched}\nEarned: ${d.totals.earned_sol.toFixed(6)} SOL\nClaimable: ${d.totals.claimable_sol.toFixed(6)} SOL\nClaimed: ${d.totals.claimed_sol.toFixed(6)} SOL\n${d.launched.slice(0, 8).map((l: any) => `• $${l.ticker} ${cfg.appUrl}/token/${l.mint}`).join("\n")}\n\n${cfg.appUrl}/scanner?wallet=${w}`, NOLINK); } catch (e: any) { await c.reply(e.message); }
  });
  bot.command("leaderboard", async c => {
    if (!hasRedis()) return c.reply("Leaderboard is offline.");
    const [d, w] = await Promise.all([leaderboard("daily", 10), leaderboard("weekly", 5)]); const nr = nextReset();
    const fmt = async (rows: any[]) => rows.length ? (await Promise.all(rows.map(async r => `${r.rank}. ${await label(r.owner)} — ${r.volume.toFixed(3)} SOL`))).join("\n") : "no volume yet";
    await c.reply(`🏆 Today (resets in ${until(nr.daily)}) — top 3 win ${PRIZES.daily.map(sol).join(" / ")} SOL\n${await fmt(d)}\n\n📅 This week (resets in ${until(nr.weekly)}) — #1 wins ${sol(PRIZES.weekly[0])} SOL\n${await fmt(w)}\n\n${cfg.appUrl}/leaderboard`, NOLINK);
  });
  bot.command("airdrops", async c => {
    const hs = await airdropHistory(10); const nr = nextReset();
    await c.reply(`🎁 Airdrops (real ${cfg.cluster} SOL to your ${cfg.brand} wallet)\nDaily top 3 by volume: ${PRIZES.daily.map(sol).join(" / ")} SOL — next in ${until(nr.daily)}\nWeekly #1: ${sol(PRIZES.weekly[0])} SOL — next in ${until(nr.weekly)}\n\nRecent:\n${hs.length ? (await Promise.all(hs.map(async (a: any) => `${a.period} ${a.period_key} #${a.rank} ${await label(a.owner_key)} ${sol(a.amount_lamports ?? 0)} SOL${a.sig ? " " + solscanTx(a.sig) : ""}`))).join("\n") : "none yet"}`, NOLINK);
  });
  const botsMenu = async (c: Context) => {
    const ms = await botMarkets("all", 12);
    if (!ms.length) return c.reply("No bonding-curve coins to boost yet. Launch one with /quick.");
    const kb = new InlineKeyboard(); ms.forEach((m, i) => { kb.text(`$${m.ticker} · ${m.status}`, `bm:${c.from!.id}:${m.mint}`); if (i % 2 === 1) kb.row(); });
    await c.reply("🤖 Volume Bots — pick a coin (real devnet trades on the bonding curve, paid from your wallet):", { reply_markup: kb });
  };
  bot.command(["bots", "volume"], c => { const m = String(c.match ?? "").trim(); if (m) return pickKind(c, m); return botsMenu(c); });
  const pickKind = (c: Context, mint: string) => { botSel.set(c.from!.id, { mint }); const kb = new InlineKeyboard(); (Object.keys(KINDS) as Kind[]).forEach((k, i) => { kb.text(KINDS[k].title, `bk:${c.from!.id}:${k}`); if (i % 2 === 1) kb.row(); }); return c.reply(`Coin ${mint}\nChoose a bot:\n${(Object.keys(KINDS) as Kind[]).map(k => `• ${KINDS[k].title}: ${KINDS[k].desc}`).join("\n")}`, { reply_markup: kb }); };
  bot.command("mybots", async c => {
    const ctx = await tgCtx(c.from!.id); const os = await myBotOrders(ctx.walletKey ?? ctx.ownerKey);
    await c.reply(os.length ? os.map((o: any) => `${o.kind} ${o.package} on $${o.ticker ?? o.mint.slice(0, 4)} — ${o.status} · ${o.trades ?? 0}/${o.max_trades} trades`).join("\n") : "No bot orders yet. /bots");
  });
  bot.command("exportkey", c => exportAsk(c));
  bot.command("importwallet", c => {
    if (c.chat?.type !== "private") return c.reply("For your safety, /importwallet only works in a private chat with me.");
    return c.reply("🔐 IMPORT YOUR OWN WALLET\nYour key is encrypted (AES-256-GCM, per-wallet key) and only decrypted to sign transactions you confirm. Use a dedicated hot wallet, never your main one.\n\nThis is optional: you can keep using your HeyClawLaunch wallet, or just set a read-only payout address with /payout <address>.", { reply_markup: new InlineKeyboard().text("I understand — import a key", `ik:${c.from!.id}`).text("Cancel", `en:${c.from!.id}`) });
  });
  bot.command("payout", async c => {
    const a = String(c.match ?? "").trim(); if (!a) { const [p] = await sql`select payout_address from tg_wallet_prefs where telegram_id=${String(c.from!.id)}`; return c.reply(`Payout address: ${p?.payout_address ?? "not set"}\nSet it with /payout <solana address>. It's read-only: withdrawals and claims can be sent there; we never hold its key.`); }
    try { new PublicKey(a); } catch { return c.reply("That isn't a valid Solana address."); }
    await sql`insert into tg_wallet_prefs(telegram_id,payout_address) values(${String(c.from!.id)},${a}) on conflict(telegram_id) do update set payout_address=excluded.payout_address, updated_at=now()`;
    await c.reply(`Payout address saved: ${a}\nSay "withdraw everything to my payout address" any time.`);
  });
  bot.command("usewallet", async c => {
    const uid = c.from!.id; const base = await getOrCreateCustodial((await tgCtx(uid)).ownerKey.startsWith("tg:") ? `tg:${uid}` : (await tgCtx(uid)).ownerKey); const imp = await findCustodial(`tgimp:${uid}`);
    const [p] = await sql`select mode from tg_wallet_prefs where telegram_id=${String(uid)}`; const mode = p?.mode ?? "custodial";
    const kb = new InlineKeyboard().text(`${mode === "custodial" ? "✅ " : ""}HeyClawLaunch wallet`, `uw:${uid}:custodial`); if (imp) kb.text(`${mode === "imported" ? "✅ " : ""}Imported wallet`, `uw:${uid}:imported`);
    await c.reply(`Which wallet should I use to launch (fee recipient), pay for bots and trade?\n• HeyClawLaunch wallet: ${base}\n• Imported wallet: ${imp ?? "none — /importwallet"}`, { reply_markup: kb });
  });
  bot.on("message:text", async (c, next) => {
    if (!awaitingKey.has(c.from.id) || c.chat.type !== "private") return next();
    awaitingKey.delete(c.from.id); await c.deleteMessage().catch(() => {});
    const kp = parseSecret(c.message.text); if (!kp) return c.reply("That doesn't look like a Solana private key (base58 or a JSON byte array). Nothing was saved. Try /importwallet again.");
    try { const pub = await importKeypair(`tgimp:${c.from.id}`, kp); kp.secretKey.fill(0);
      await sql`insert into tg_wallet_prefs(telegram_id,mode) values(${String(c.from.id)},'imported') on conflict(telegram_id) do update set mode='imported', updated_at=now()`;
      await sql`insert into audit_log(actor,action,detail) values(${`tgimp:${c.from.id}`},'import_key',${JSON.stringify({ address: pub })})`;
      await c.reply(`✅ Imported ${pub} and switched to it. I deleted your message with the key.\nSwitch back any time with /usewallet.`);
    } catch (e) { await c.reply(err(e)); }
  });
  const exportAsk = (c: Context) => {
    if (c.chat?.type !== "private") return c.reply("For your safety, /exportkey only works in a private chat with me.");
    return c.reply("⚠️ EXPORT PRIVATE KEY\nAnyone with this key fully controls your wallet and everything in it. Never share it, never paste it into websites. We will never ask for it.\n\nOnly continue if you are alone and understand the risk.", { reply_markup: new InlineKeyboard().text("I understand — reveal", `ey:${c.from!.id}`).text("Cancel", `en:${c.from!.id}`) });
  };

  bot.on("callback_query:data", async (c, next) => {
    const [kind, uid, ...rest] = c.callbackQuery.data.split(":"); const arg = rest.join(":");
    if (!["tp", "bm", "bk", "bp", "bc", "ek", "ey", "en", "wl", "ik", "uw"].includes(kind)) return next();
    if (String(c.from.id) !== uid) return c.answerCallbackQuery({ text: "Only the person who asked can use these buttons.", show_alert: true });
    await c.answerCallbackQuery(); const ctx = await tgCtx(c.from.id);
    try {
      if (kind === "wl") return c.reply(await myWallet(ctx), NOLINK);
      if (kind === "ik") { awaitingKey.add(c.from.id); return c.editMessageText("Send the private key now as your next message (base58 or JSON byte array). I'll delete it right after reading it."); }
      if (kind === "uw") { await sql`insert into tg_wallet_prefs(telegram_id,mode) values(${String(c.from.id)},${arg}) on conflict(telegram_id) do update set mode=excluded.mode, updated_at=now()`; const n = await tgCtx(c.from.id); return c.reply(`Now using your ${arg === "imported" ? "imported" : "HeyClawLaunch"} wallet: ${await getOrCreateCustodial(n.walletKey!)}`); }
      if (kind === "ek") return exportAsk(c);
      if (kind === "en") return c.editMessageText("Cancelled. Your key was not shown.");
      if (kind === "ey") {
        if (c.chat?.type !== "private") return c.reply("Private chat only.");
        const address = await getOrCreateCustodial(ctx.walletKey!);
        const secret = await withCustodialSigner(ctx.walletKey!, async kp => bs58.encode(kp.secretKey));
        await sql`insert into audit_log(actor,action,detail) values(${ctx.walletKey},'export_key',${JSON.stringify({ address, surface: "telegram" })})`;
        await c.editMessageText("Key sent below. Delete that message once you've saved it.");
        return c.reply(`Wallet ${address}\nPrivate key (base58, import in Phantom/Solflare/Backpack):\n\n<tg-spoiler>${secret}</tg-spoiler>`, { parse_mode: "HTML", protect_content: true });
      }
      if (kind === "tp") {
        await c.replyWithChatAction("typing").catch(() => {});
        const r = await draftFromTemplate(ctx, arg); h.setDraft(c, r.draft.id);
        const card = `PREVIEW · template\n${r.template.name} ($${r.template.ticker})\n${r.template.description ?? ""}\n\nFees: 80% to your ${cfg.brand} wallet ${r.wallet} · 20% platform\nPair: ${r.template.pair || "SOL"} · no dev buy · 0 SOL\n\nTap Confirm to launch (permanent).`;
        if (!r.ready) return c.reply(`${card}\n\n${r.text}`);
        const p = await createPending(ctx, "confirm_launch", { draft_id: r.draft.id });
        const kb = new InlineKeyboard().text("✅ Confirm launch", `c:${p.id}`).text("Cancel", `x:${p.id}`);
        return r.template.logo_url ? c.replyWithPhoto(r.template.logo_url, { caption: card.slice(0, 1000), reply_markup: kb }).catch(() => c.reply(card, { reply_markup: kb })) : c.reply(card, { reply_markup: kb });
      }
      if (kind === "bm") return pickKind(c, arg);
      if (kind === "bk") {
        const s = botSel.get(c.from.id) ?? {}; s.kind = arg as Kind; botSel.set(c.from.id, s);
        const kb = new InlineKeyboard(); KINDS[s.kind].pkgs.forEach(p => kb.text(`${p.name} · ${sol(p.price)} SOL`, `bp:${c.from.id}:${p.id}`).row());
        return c.reply(`${KINDS[s.kind].title} packages:\n${KINDS[s.kind].pkgs.map(p => `• ${p.name} ${sol(p.price)} SOL — ${p.blurb}`).join("\n")}`, { reply_markup: kb });
      }
      if (kind === "bp" || kind === "bc") {
        const s = botSel.get(c.from.id); if (!s?.mint || !s.kind) return c.reply("Start again with /bots.");
        const r: any = await orderBot(ctx, { mint: s.mint, kind: s.kind, package: arg, confirm: kind === "bc" });
        return c.reply(r.text, { ...NOLINK, reply_markup: r.preview ? new InlineKeyboard().text("✅ Pay & start", `bc:${c.from.id}:${arg}`).text("Cancel", `en:${c.from.id}`) : undefined });
      }
    } catch (e) { await c.reply(err(e)); }
  });
  void listCoins; void fmtQ;
}
