import { createHash, randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import type { Ctx } from "./ctx";
import { UserError, vName, vTicker, vDesc, vWebsite, vX, vTelegram, vHandle, vAddress, isNothing } from "./validate";
import { resolveLogo } from "./logo";
import { resolvePair } from "./pairs";
import { resolveXHandle } from "@/lib/xapi";
import { gatewayUrl } from "@/lib/ipfs";

export type Draft = Record<string, any> & { id: string; owner_key: string; status: string };
export type PrepareArgs = { auto_fill?: boolean; theme?: string; draft_id?: string; start_new?: boolean; name?: string; ticker?: string; logo_image?: string; logo_url?: string; description?: string; website?: string; x?: string; telegram?: string; pair?: string; fee_mode?: "x" | "wallet" | "holders"; fee_x?: string; fee_wallet?: string; skip_socials?: boolean; creator_fee_percent?: number };

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const UPLOAD_TTL_MS = 2 * 3600_000;

export async function loadDraft(ctx: Ctx, id: string): Promise<Draft> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError("Unknown draft_id.");
  const [d] = await sql<Draft[]>`select * from drafts where id=${id}`;
  if (!d || d.owner_key !== ctx.ownerKey) throw new UserError("Unknown draft_id (it belongs to another session, or it expired). Call prepare_launch with start_new: true.");
  return d;
}
async function openDraft(ctx: Ctx): Promise<Draft | undefined> {
  const [d] = await sql<Draft[]>`select * from drafts where owner_key=${ctx.ownerKey} and status in ('open','ready') and updated_at > now() - interval '24 hours' order by updated_at desc limit 1`;
  return d;
}
export async function newUploadLink(draftId: string) {
  const token = randomBytes(18).toString("base64url");
  await sql`update drafts set upload_token_hash=${sha(token)}, upload_expires_at=${new Date(Date.now() + UPLOAD_TTL_MS)} where id=${draftId}`;
  return { token, url: `${cfg.appUrl}/upload/${draftId}?t=${token}` };
}
export async function checkUploadToken(draftId: string, token: string): Promise<Draft> {
  const [d] = await sql<Draft[]>`select * from drafts where id=${draftId}`;
  if (!d || !token || d.upload_token_hash !== sha(token)) throw new UserError("Invalid upload link.");
  if (!d.upload_expires_at || new Date(d.upload_expires_at).getTime() < Date.now()) throw new UserError("This upload link expired (links are valid for 2 hours). Ask for a new one.");
  if (!["open", "ready"].includes(d.status)) throw new UserError("This coin was already launched.");
  return d;
}

export function feeLabel(d: Draft) {
  if (d.fee_mode === "x") return `@${d.fee_x_handle} · ${cfg.brand} wallet`;
  if (d.fee_mode === "wallet") return d.fee_wallet;
  if (d.fee_mode === "holders") return "holders";
  return "—";
}
const needsCreatorFee = (d: Draft) => d.pair_symbol && !["SOL", "USDC"].includes(d.pair_symbol);

export function nextQuestion(d: Draft): { key: string; q: string } | null {
  if (!d.name) return { key: "name", q: "What's the name of your coin?" };
  if (!d.ticker) return { key: "ticker", q: "What's the ticker? (letters and digits only, max 10, e.g. DOGE)" };
  if (!d.logo_cid) return { key: "logo", q: "Send me the logo: paste an image link, or upload the file on this private page:" };
  if (!d.fee_mode) return { key: "fees", q: "Where should the creator fees go: to an X account (which @handle?), to a Solana wallet (which address?), or shared with the holders?" };
  if (!d.pair_mint) return { key: "pair", q: "Which asset should it trade against? SOL is the default (you can also pick USDC, a stock or a token)." };
  if (needsCreatorFee(d) && !d.creator_fee_done) return { key: "creator_fee", q: "Custom creator fee per trade, from 0.01 to 3 %? Say 0 to use pump.fun's default." };
  if (d.description === null || d.description === undefined) return { key: "description", q: "Give me a short description of the coin (or say \"nothing\")." };
  if (!d.socials_done && (d.website == null || d.x == null || d.telegram == null)) return { key: "links", q: "Any links: website, X, Telegram? (or say \"skip\")" };
  return null;
}
export function summary(d: Draft) {
  const links = [d.website, d.x, d.telegram].filter(Boolean).join(" · ") || "none";
  return [
    `Name: ${d.name ?? "—"}`, `Ticker: ${d.ticker ? "$" + d.ticker : "—"}`, `Logo: ${d.logo_cid ? gatewayUrl(d.logo_cid) : "—"}`,
    `Fees: ${feeLabel(d)}`, `Pair: ${d.pair_symbol ?? "—"}`,
    ...(needsCreatorFee(d) ? [`Creator fee: ${d.creator_fee_bps ? (d.creator_fee_bps / 100) + " %" : "pump.fun default"}`] : []),
    `Description: ${d.description === null || d.description === undefined ? "—" : d.description || "none"}`, `Links: ${links}`,
  ].join("\n");
}

export async function prepareLaunch(ctx: Ctx, a: PrepareArgs): Promise<{ text: string; draft: Draft; uploadUrl?: string; ready: boolean; error?: string }> {
  let d: Draft = undefined as unknown as Draft;
  if (a.start_new) {
    // Models often resend start_new on later turns; don't throw away a fresh, in-progress draft unless a different coin is clearly meant.
    const cur = (await openDraft(ctx)) as Draft | undefined;
    const fresh = cur && Date.now() - +new Date((cur as any).updated_at ?? 0) < 15 * 60_000;
    const different = a.name && cur?.name && a.name.trim().toLowerCase() !== cur.name.toLowerCase();
    if (cur && fresh && !different && !(a.auto_fill && cur.name)) d = cur;
    else await sql`update drafts set status='discarded' where owner_key=${ctx.ownerKey} and status in ('open','ready')`;
  }
  else if (a.draft_id) d = await loadDraft(ctx, a.draft_id);
  else d = (await openDraft(ctx)) as Draft;
  if (d && !["open", "ready"].includes(d.status)) {
    if (d.status === "launched") throw new UserError(`This draft was already launched. Call prepare_launch with start_new: true for a new coin.`);
    if (d.status === "launching") throw new UserError("This coin is launching right now. Check it with launch_status.");
  }
  if (!d) [d] = await sql<Draft[]>`insert into drafts(owner_key) values(${ctx.ownerKey}) returning *`;
  if (!d) throw new Error("draft insert failed");
  const upd: Record<string, any> = {};
  let err: string | undefined; const notes: string[] = [];
  // "make me a coin / you come up with everything": fill every missing creative field in one go
  if (a.auto_fill && (!(a.name ?? d.name) || !(a.ticker ?? d.ticker) || !(a.logo_image || a.logo_url || d.logo_cid) || (a.description ?? d.description) == null)) {
    const { generateTokenIdea } = await import("@/lib/image-gen");
    const t = await generateTokenIdea(a.theme ?? a.name ?? d.name ?? undefined);
    if (!(a.name ?? d.name)) a.name = t.name; if (!(a.ticker ?? d.ticker)) a.ticker = t.ticker;
    if ((a.description ?? d.description) == null) a.description = t.description;
    if (!(a.logo_image || a.logo_url || d.logo_cid) && t.logo?.cid) upd.logo_cid = t.logo.cid;
    if (a.skip_socials === undefined && !d.socials_done) a.skip_socials = true;
    if (a.pair === undefined && !d.pair_mint) a.pair = "SOL";
    notes.push(`Auto-filled: ${a.name} ($${a.ticker})`);
  }
  // fees: use the signed-in / connected wallet automatically when nothing was chosen
  if (!a.fee_mode && !a.fee_wallet && !a.fee_x && !d.fee_mode) {
    if (ctx.walletAddress) { a.fee_mode = "wallet"; a.fee_wallet = ctx.walletAddress; notes.push(`Fees go to your connected wallet ${ctx.walletAddress} (say another wallet or an X handle to change).`); }
    else if (ctx.xUserId) { a.fee_mode = "x"; a.fee_x = "me"; notes.push(`Fees go to your X account @${ctx.xUsername ?? ctx.xUserId} (say a wallet to change).`); }
  }
  const tryField = async (fn: () => Promise<void> | void) => { try { await fn(); } catch (e) { if (e instanceof UserError) err ??= e.message; else throw e; } };
  if (a.name !== undefined) await tryField(() => { upd.name = vName(a.name!); });
  if (a.ticker !== undefined) await tryField(() => { upd.ticker = vTicker(a.ticker!); });
  const logo = a.logo_image || a.logo_url;
  if (logo) await tryField(async () => { upd.logo_cid = await resolveLogo(logo); });
  if (a.fee_mode) await tryField(async () => {
    if (a.fee_mode === "holders") Object.assign(upd, { fee_mode: "holders", fee_x_handle: null, fee_x_user_id: null, fee_wallet: null });
    else if (a.fee_mode === "wallet") {
      const w = a.fee_wallet ?? ctx.walletAddress;
      if (!w) throw new UserError("Which Solana wallet address should receive the fees?");
      Object.assign(upd, { fee_mode: "wallet", fee_wallet: vAddress(w), fee_x_handle: null, fee_x_user_id: null });
    } else {
      let handle: string, id: string;
      const self = !a.fee_x || /^(me|my|mine|myself|my x( account)?)$/i.test(a.fee_x.trim());
      if (self) {
        if (!ctx.xUserId) throw new UserError("You're not signed in with X here, so I can't use \"my X account\". Which @handle should receive the fees?");
        handle = ctx.xUsername ?? ctx.xUserId; id = ctx.xUserId;
      } else { handle = vHandle(a.fee_x!); id = await resolveXHandle(handle); }
      Object.assign(upd, { fee_mode: "x", fee_x_handle: handle, fee_x_user_id: id, fee_wallet: null });
    }
  });
  else if (a.fee_wallet) await tryField(() => { Object.assign(upd, { fee_mode: "wallet", fee_wallet: vAddress(a.fee_wallet!) }); });
  else if (a.fee_x) await tryField(async () => { const h = vHandle(a.fee_x!); Object.assign(upd, { fee_mode: "x", fee_x_handle: h, fee_x_user_id: await resolveXHandle(h) }); });
  if (a.pair !== undefined) await tryField(async () => { const p = await resolvePair(a.pair!); upd.pair_mint = p.mint; upd.pair_symbol = p.symbol; if (["SOL", "USDC"].includes(p.symbol)) { upd.creator_fee_bps = null; upd.creator_fee_done = true; } });
  if (a.creator_fee_percent !== undefined) await tryField(() => {
    const sym = upd.pair_symbol ?? d!.pair_symbol;
    if (sym && ["SOL", "USDC"].includes(sym)) { if (a.creator_fee_percent) throw new UserError("A custom creator fee is only allowed on stock/token pairs, not SOL or USDC."); return; }
    const p = Number(a.creator_fee_percent);
    if (!(p === 0 || (p >= 0.01 && p <= 3))) throw new UserError("The creator fee must be 0 (default) or between 0.01 and 3 %.");
    upd.creator_fee_bps = Math.round(p * 100) || null; upd.creator_fee_done = true;
  });
  if (a.description !== undefined) await tryField(() => { upd.description = vDesc(a.description!); });
  if (a.website !== undefined) await tryField(() => { upd.website = vWebsite(a.website!); });
  if (a.x !== undefined) await tryField(() => { upd.x = vX(a.x!); });
  if (a.telegram !== undefined) await tryField(() => { upd.telegram = vTelegram(a.telegram!); });
  if (a.skip_socials) { upd.socials_done = true; }
  else if ([a.website, a.x, a.telegram].some(v => v !== undefined && isNothing(v))) { /* explicit "nothing" for one link only */ }
  if (Object.keys(upd).length) {
    upd.updated_at = new Date();
    [d] = await sql<Draft[]>`update drafts set ${sql(upd)} where id=${d.id} returning *`;
  }
  // after any link was provided, consider links done if all three are answered
  if (!d.socials_done && d.website != null && d.x != null && d.telegram != null) [d] = await sql<Draft[]>`update drafts set socials_done=true where id=${d.id} returning *`;
  const nq = nextQuestion(d);
  const status = nq ? "open" : "ready";
  if (status !== d.status) [d] = await sql<Draft[]>`update drafts set status=${status} where id=${d.id} returning *`;
  let text = `draft_id: ${d.id}\n`;
  if (err) text += `ERROR: ${err}\n`;
  if (notes.length) text += notes.map(n => `NOTE: ${n}`).join("\n") + "\n";
  text += `\nCurrent draft:\n${summary(d)}\n\n`;
  let uploadUrl: string | undefined;
  if (nq) {
    text += `NEXT QUESTION: ${nq.q}`;
    if (nq.key === "logo") { uploadUrl = (await newUploadLink(d.id)).url; text += ` ${uploadUrl} (private link, valid 2 hours)`; }
  } else text += `READY\n${summary(d)}\nAsk: Launch it?`;
  return { text, draft: d, uploadUrl, ready: !nq, error: err };
}

export async function launchStatus(ctx: Ctx, id: string) {
  const d = await loadDraft(ctx, id);
  const [l] = await sql`select * from launches where draft_id=${d.id}`;
  let t = `draft_id: ${d.id}\nstatus: ${d.status}\n${summary(d)}`;
  if (d.status === "failed" && d.error) t += `\nerror: ${d.error}`;
  if (l) t += `\nmint: ${l.mint}\ncreate tx: ${l.create_sig}\nfee split: ${l.split_status}${l.split_sig ? " " + l.split_sig : ""}\ntrade: https://pump.fun/coin/${l.mint}\npage: ${cfg.appUrl}/token/${l.mint}`;
  return t;
}
