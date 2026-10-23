import { friendlyChainError } from "@/lib/solana/errors";
import { PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import type { Ctx } from "./ctx";
import { UserError } from "./validate";
import { loadDraft, nextQuestion, feeLabel, type Draft } from "./drafts";
import { conn, createCoin, splitFees, launchWallet } from "@/lib/solana";
import { pinJson, gatewayUrl } from "@/lib/ipfs";
import { getOrCreateCustodial } from "@/lib/keystore";
import { issueClaimCode } from "./claims";

const dayUtc = () => new Date().toISOString().slice(0, 10);
function limitKeys(ctx: Ctx, recipient: string | null) {
  const keys = new Set<string>([ctx.ownerKey]);
  if (ctx.xUserId) keys.add(`x:${ctx.xUserId}`);
  if (ctx.ip) keys.add(`ip:${ctx.ip}`);
  if (recipient) keys.add(`wallet:${recipient}`);
  return [...keys];
}
export async function launchesLeft(ctx: Ctx) {
  const rows = await sql`select max(count) m from launch_counters where key = any(${limitKeys(ctx, null)}) and day_utc=${dayUtc()}`;
  return Math.max(0, cfg.limitPerDay - Number(rows[0]?.m ?? 0));
}
async function takeLimit(keys: string[]) {
  return sql.begin(async (tx: any) => {
    for (const k of keys) {
      const [r] = await tx`insert into launch_counters(key,day_utc,count) values(${k},${dayUtc()},1) on conflict(key,day_utc) do update set count=launch_counters.count+1 returning count`;
      if (r.count > cfg.limitPerDay) throw new UserError(`Daily launch limit reached (${cfg.limitPerDay} per day${k.startsWith("wallet:") ? " for this fee wallet" : ""}). It resets at 00:00 UTC.`);
    }
  });
}
async function releaseLimit(keys: string[]) { for (const k of keys) await sql`update launch_counters set count=greatest(count-1,0) where key=${k} and day_utc=${dayUtc()}`; }

async function recipientFor(d: Draft): Promise<string | null> {
  if (d.fee_mode === "wallet") return d.fee_wallet;
  if (d.fee_mode === "x") return getOrCreateCustodial(`x:${d.fee_x_user_id}`);
  return null;
}

export async function runSplit(launchId: string) {
  const [l] = await sql`select * from launches where id=${launchId}`;
  if (!l || l.split_status !== "pending") return l;
  try {
    const sig = await splitFees(new PublicKey(l.mint), new PublicKey(l.recipient), new PublicKey(l.quote_mint));
    const [u] = await sql`update launches set split_status='done', split_sig=${sig} where id=${launchId} returning *`;
    return u;
  } catch (e: any) {
    await sql`update launches set split_attempts=split_attempts+1 where id=${launchId}`;
    await sql`insert into audit_log(actor,action,detail) values('system','split_failed',${sql.json({ launchId, error: String(e?.message ?? e).slice(0, 500) })})`;
    return (await sql`select * from launches where id=${launchId}`)[0];
  }
}

export type LaunchResult = { text: string; mint?: string; pageUrl?: string; pumpUrl?: string; createSig?: string; splitSig?: string; claimCode?: string };
export async function confirmLaunch(ctx: Ctx, draftId: string): Promise<LaunchResult> {
  let d = await loadDraft(ctx, draftId);
  if (d.status === "launched") { const [l] = await sql`select * from launches where draft_id=${d.id}`; return okText(d, l); }
  if (d.status === "launching") throw new UserError("This coin is already launching. Check it with launch_status.");
  const nq = nextQuestion(d);
  if (nq) throw new UserError(`The draft isn't complete yet. NEXT QUESTION: ${nq.q}`);
  if (!cfg.launchesEnabled) throw new UserError("Launches are paused right now. Try again later.");
  const launch = launchWallet();
  const bal = await conn().getBalance(launch.publicKey);
  if (bal < cfg.launchMin) throw new UserError("Launch wallet is low on SOL. Please try again later.");
  const recipient = await recipientFor(d);
  const keys = limitKeys(ctx, recipient);
  await takeLimit(keys); // rolls back by itself when over the limit
  const [lock] = await sql`update drafts set status='launching', updated_at=now() where id=${d.id} and status='ready' returning id`;
  if (!lock) { await releaseLimit(keys); throw new UserError("This coin is already launching."); }
  let createdMint: string | null = null;
  try {
    const meta: Record<string, unknown> = { name: d.name, symbol: d.ticker, description: d.description ?? "", image: gatewayUrl(d.logo_cid), showName: true, createdOn: cfg.appUrl, website: d.website || cfg.appUrl };
    if (d.x) meta.twitter = d.x; if (d.telegram) meta.telegram = d.telegram;
    const metaCid = await pinJson(meta);
    const created = await createCoin({ name: d.name, symbol: d.ticker, uri: gatewayUrl(metaCid), holders: d.fee_mode === "holders", quoteMint: new PublicKey(d.pair_mint), creatorFeeBps: d.creator_fee_bps ?? undefined });
    const { mint, sig } = created; createdMint = mint.toBase58();
    const [l] = await sql`insert into launches(draft_id,owner_key,mint,create_sig,split_status,metadata_cid,creator,recipient,quote_mint,is_holder_reward,creator_fee_bps,name,ticker,logo_cid,fee_label)
      values(${d.id},${ctx.ownerKey},${mint.toBase58()},${sig},${recipient ? "pending" : "none"},${metaCid},${launch.publicKey.toBase58()},${recipient},${d.pair_mint},${d.fee_mode === "holders"},${d.creator_fee_bps},${d.name},${d.ticker},${d.logo_cid},${feeLabel(d)}) returning *`;
    [d] = await sql<Draft[]>`update drafts set status='launched', updated_at=now() where id=${d.id} returning *`;
    const l2 = recipient ? await runSplit(l.id) : l;   // tx 2; the worker retries if it failed
    const code = d.fee_mode === "wallet" && recipient ? await issueClaimCode(l.mint, recipient).catch(() => null) : null;
    const r = okText(d, l2);
    if (code) { r.claimCode = code; r.text += `\n  CLAIM CODE (shown once, save it): ${code}\n  Claim fees any time at ${cfg.appUrl}/claim with your wallet + this code, or by connecting that wallet.`; }
    return r;
  } catch (e: any) {
    if (createdMint) { // the coin exists on chain: never report "nothing was created" or free the limit
      await sql`insert into audit_log(actor,action,detail) values('system','launch_post_create_failed',${sql.json({ draftId: d.id, mint: createdMint, error: String(e?.message ?? e).slice(0, 500) })})`.catch(() => {});
      throw new UserError(`Your coin was created on chain (mint ${createdMint}) but saving it hit an error. Don't relaunch — it's safe; check ${cfg.appUrl}/token/${createdMint} in a minute or contact support.`);
    }
    await releaseLimit(keys);
    await sql`update drafts set status='ready', error=${String(e?.message ?? e).slice(0, 500)} where id=${d.id}`;
    if (e instanceof UserError) throw e;
    if (String(e?.message).includes("\"Custom\":6084")) throw new UserError("pump.fun has holder-reward coins disabled on this cluster right now. Choose fees to a wallet or an X account instead.");
    throw new UserError(`The launch failed and nothing was created: ${friendlyChainError(e)}`);
  }
}
function okText(d: Draft, l: any): LaunchResult {
  const pageUrl = `${cfg.appUrl}/token/${l.mint}`, pumpUrl = `https://pump.fun/coin/${l.mint}`;
  const text = `$${d.ticker} is live!\n  token ${l.mint}\n  pair ${d.pair_symbol}\n  fees ${l.fee_label}${l.split_status === "pending" ? " (fee split pending, retrying)" : ""}\n  dev buy none\n  trade pump.fun/coin/${l.mint}\n  page ${pageUrl}\n  tx ${l.create_sig}${l.split_sig ? `\n  fee split tx ${l.split_sig}` : ""}${cfg.cluster !== "mainnet-beta" ? `\n  (cluster: ${cfg.cluster})` : ""}`;
  return { text, mint: l.mint, pageUrl, pumpUrl, createSig: l.create_sig, splitSig: l.split_sig };
}

export async function myLaunches(ctx: Ctx) {
  const drafts = await sql`select id,name,ticker,status,updated_at from drafts where owner_key=${ctx.ownerKey} and status in ('open','ready','launching','failed') order by updated_at desc limit 10`;
  const launches = await sql`select mint,name,ticker,fee_label,launched_at from launches where owner_key=${ctx.ownerKey} order by launched_at desc limit 50`;
  const left = await launchesLeft(ctx);
  return [
    `Drafts (${drafts.length}):`, ...drafts.map((d: any) => `- ${d.name ?? "(unnamed)"}${d.ticker ? " $" + d.ticker : ""} — ${d.status} — draft_id ${d.id}`),
    `Launched (${launches.length}):`, ...launches.map((l: any) => `- $${l.ticker} (${l.name}) — ${l.mint} — fees ${l.fee_label} — ${cfg.appUrl}/token/${l.mint}`),
    `launches left today: ${left} (resets 00:00 UTC)`,
  ].join("\n");
}
