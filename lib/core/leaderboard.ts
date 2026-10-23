// Volume indexer + real-time leaderboard (Upstash sorted sets) + daily/weekly devnet SOL airdrops.
import { PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { conn, launchWallet } from "@/lib/solana";
import { bondingCurvePda } from "@/lib/solana/pump";
import { redis } from "@/lib/redis";
import { getOrCreateCustodial } from "@/lib/keystore";
import { sendSol } from "@/lib/trade/curve";
import { cfg, solscanTx } from "@/lib/config";

export const PRIZES = { daily: [10_000_000n, 6_000_000n, 4_000_000n], weekly: [20_000_000n] }; // devnet lamports
const NS = "hcl:lb";
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export function weekKey(d = new Date()) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((+t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, "0")}`; }
const zkey = (p: "all" | "daily" | "weekly", k?: string) => p === "all" ? `${NS}:all` : `${NS}:${p}:${k}`;

/** Indexes new bonding-curve trades of every SOL-pair coin launched here and credits volume to the coin's owner. */
export async function indexTradesOnce(maxCoins = 40) {
  const coins = await sql`select l.mint, l.owner_key, c.last_sig from launches l left join index_cursor c on c.mint=l.mint where l.mint is not null and (l.quote_mint is null or l.quote_mint='So11111111111111111111111111111111111111112') order by coalesce(c.updated_at, 'epoch') limit ${maxCoins}`;
  // coins with a running bot are indexed every pass so their charts stay live
  const hot = await sql`select distinct o.mint, l.owner_key, c.last_sig from bot_orders o join launches l on l.mint=o.mint left join index_cursor c on c.mint=o.mint where o.status in ('queued','running') or o.updated_at > now() - interval '5 minutes'`;
  for (const h of hot) if (!coins.some((x: any) => x.mint === h.mint)) coins.push(h);
  const { curveStates } = await import("@/lib/core/market"); const cst = await curveStates(coins.map((c: any) => c.mint)).catch(() => new Map());
  const grad = new Set([...cst.entries()].filter(([, v]: any) => v?.complete).map(([m]: any) => m as string));
  let n = 0;
  for (const c of coins) {
    const curve = bondingCurvePda(new PublicKey(c.mint));
    const sigs = await conn().getSignaturesForAddress(curve, { until: c.last_sig ?? undefined, limit: 50 }).catch(() => []);
    const fresh = sigs.filter(s => !s.err).reverse();
    for (const s of fresh) {
      const tx = await conn().getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
      if (!tx?.meta) continue;
      const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses }).staticAccountKeys.concat(tx.meta.loadedAddresses?.writable ?? [], tx.meta.loadedAddresses?.readonly ?? []);
      const i = keys.findIndex(k => k.equals(curve)); if (i < 0) continue;
      if (tx.meta.preBalances[i] === 0) continue; // curve creation (rent), not a trade
      const delta = BigInt(tx.meta.postBalances[i] - tx.meta.preBalances[i]);
      if (delta === 0n) continue; // create / fee ops
      const lam = delta < 0n ? -delta : delta, side = delta > 0n ? "buy" : "sell";
      const tb = (arr: any[] | null | undefined) => Number(arr?.find(b => b.mint === c.mint && b.owner === curve.toBase58())?.uiTokenAmount?.uiAmount ?? 0);
      const tokens = Math.abs(tb(tx.meta.postTokenBalances) - tb(tx.meta.preTokenBalances));
      const price = tokens > 0 ? Number(lam) / 1e9 / tokens : null;
      const ins = await sql`insert into curve_trades(sig,mint,owner_key,side,lamports,trader,ts,tokens,price) values(${s.signature},${c.mint},${c.owner_key},${side},${lam.toString()},${keys[0].toBase58()},${new Date((s.blockTime ?? Date.now() / 1000) * 1000)},${tokens},${price}) on conflict do nothing returning sig`;
      if (!ins.length) continue;
      const when = new Date((s.blockTime ?? Date.now() / 1000) * 1000), sol = Number(lam) / 1e9;
      const r = redis(); const p = r.pipeline();
      p.zincrby(zkey("all"), sol, c.owner_key); p.zincrby(zkey("daily", dayKey(when)), sol, c.owner_key); p.zincrby(zkey("weekly", weekKey(when)), sol, c.owner_key);
      p.expire(zkey("daily", dayKey(when)), 86400 * 30); p.expire(zkey("weekly", weekKey(when)), 86400 * 120);
      p.lpush(`${NS}:feed`, JSON.stringify({ sig: s.signature, mint: c.mint, side, sol, price, ts: +when })); p.ltrim(`${NS}:feed`, 0, 99);
      await p.exec(); n++;
    }
    const top = sigs[0]?.signature ?? c.last_sig;
    await sql`insert into index_cursor(mint,last_sig,updated_at) values(${c.mint},${top},now()) on conflict(mint) do update set last_sig=excluded.last_sig, updated_at=now()`;
    if (grad.has(c.mint)) n += await indexPoolOnce(c.mint, c.owner_key).catch(() => 0);
  }
  return n;
}

/** Graduated coins trade on their PumpSwap pool: record swaps (pool base/quote vault deltas) so charts, volume and the leaderboard continue after migration. */
async function indexPoolOnce(mint: string, ownerKey: string) {
  const { poolKeyOf } = await import("@/lib/core/amm"); const pool = poolKeyOf(mint); const pk = pool.toBase58(); const ck = `amm:${mint}`;
  const [cur] = await sql`select last_sig from index_cursor where mint=${ck}`;
  const sigs = await conn().getSignaturesForAddress(pool, { until: cur?.last_sig ?? undefined, limit: 50 }).catch(() => []);
  let n = 0;
  for (const s of sigs.filter(x => !x.err).reverse()) {
    const tx = await conn().getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null); if (!tx?.meta) continue;
    const bal = (arr: any[] | null | undefined, m: string) => Number(arr?.find(b => b.mint === m && b.owner === pk)?.uiTokenAmount?.uiAmount ?? 0);
    const dq = bal(tx.meta.postTokenBalances, WSOL) - bal(tx.meta.preTokenBalances, WSOL), db = bal(tx.meta.postTokenBalances, mint) - bal(tx.meta.preTokenBalances, mint);
    if (!dq || !db || Math.sign(dq) === Math.sign(db)) continue; // deposits/withdrawals move both the same way
    const side = dq > 0 ? "buy" : "sell", lam = BigInt(Math.round(Math.abs(dq) * 1e9)), tokens = Math.abs(db), price = Math.abs(dq) / tokens;
    const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses });
    const when = new Date((s.blockTime ?? Date.now() / 1000) * 1000);
    const ins = await sql`insert into curve_trades(sig,mint,owner_key,side,lamports,trader,ts,tokens,price) values(${s.signature},${mint},${ownerKey},${side},${lam.toString()},${keys.get(0)!.toBase58()},${when},${tokens},${price}) on conflict do nothing returning sig`;
    if (!ins.length) continue;
    const sol = Number(lam) / 1e9; const r = redis(); const p = r.pipeline();
    p.zincrby(zkey("all"), sol, ownerKey); p.zincrby(zkey("daily", dayKey(when)), sol, ownerKey); p.zincrby(zkey("weekly", weekKey(when)), sol, ownerKey);
    p.lpush(`${NS}:feed`, JSON.stringify({ sig: s.signature, mint, side, sol, price, ts: +when })); p.ltrim(`${NS}:feed`, 0, 99); await p.exec(); n++;
  }
  if (sigs[0]) await sql`insert into index_cursor(mint,last_sig,updated_at) values(${ck},${sigs[0].signature},now()) on conflict(mint) do update set last_sig=excluded.last_sig, updated_at=now()`;
  return n;
}
const WSOL = "So11111111111111111111111111111111111111112";

export async function label(ownerKey: string) {
  if (ownerKey.startsWith("x:")) { const [h] = await sql`select handle from x_handles where x_user_id=${ownerKey.slice(2)} limit 1`; return h ? `@${h.handle}` : `X user ${ownerKey.slice(-4)}`; }
  if (ownerKey.startsWith("user:")) { const [u] = await sql`select wallet_address, x_username from users where id=${ownerKey.slice(5)}::uuid`.catch(() => []); if (u?.x_username) return `@${u.x_username}`; if (u?.wallet_address) return `${u.wallet_address.slice(0, 4)}…${u.wallet_address.slice(-4)}`; }
  if (ownerKey.startsWith("tg:")) return `Telegram ···${ownerKey.slice(-4)}`;
  if (ownerKey.startsWith("agent:")) { const [a] = await sql`select handle from agents where id::text=${ownerKey.slice(6)}`.catch(() => []); if (a) return `@${a.handle}`; }
  return ownerKey.slice(0, 12);
}
export type Row = { rank: number; owner: string; label: string; volume: number; coins: number };
export async function leaderboard(period: "all" | "daily" | "weekly" = "daily", limit = 25, at = new Date()): Promise<Row[]> {
  const k = zkey(period, period === "daily" ? dayKey(at) : weekKey(at));
  const raw = (await redis().zrange(k, 0, limit - 1, { rev: true, withScores: true })) as (string | number)[];
  const rows: Row[] = [];
  for (let i = 0; i < raw.length; i += 2) rows.push({ rank: i / 2 + 1, owner: String(raw[i]), label: "", volume: Number(raw[i + 1]), coins: 0 });
  if (rows.length) { const cs = await sql`select owner_key, count(*)::int n from launches where owner_key = any(${rows.map(r => r.owner)}) group by owner_key`; const m = new Map(cs.map((c: any) => [c.owner_key, c.n])); for (const r of rows) { r.coins = (m.get(r.owner) as number) ?? 0; r.label = await label(r.owner); } }
  return rows;
}
export function nextReset(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const w = new Date(d); while (w.getUTCDay() !== 1) w.setUTCDate(w.getUTCDate() + 1);
  return { daily: d.toISOString(), weekly: w.toISOString() };
}
/** Pays the previous period's winners once (idempotent by unique(period, period_key, rank)). */
export async function runAirdropsOnce(now = new Date()) {
  const out: any[] = [];
  const prevDay = new Date(now.getTime() - 864e5), prevWeek = new Date(now.getTime() - 7 * 864e5);
  for (const [period, at] of [["daily", prevDay], ["weekly", prevWeek]] as const) {
    const key = period === "daily" ? dayKey(at) : weekKey(at);
    const rows = await leaderboard(period, PRIZES[period].length, at);
    for (const r of rows) {
      const amount = PRIZES[period][r.rank - 1]; if (!amount || r.volume <= 0) continue;
      const ins = await sql`insert into airdrops(period,period_key,rank,owner_key,volume_lamports,amount_lamports) values(${period},${key},${r.rank},${r.owner},${Math.round(r.volume * 1e9)},${amount.toString()}) on conflict do nothing returning id`;
      if (!ins.length) continue;
      try {
        const wallet = await getOrCreateCustodial(r.owner);
        const sig = await sendSol(launchWallet(), new PublicKey(wallet), amount);
        await sql`update airdrops set status='paid', sig=${sig}, wallet=${wallet} where id=${ins[0].id}`;
        out.push({ period, key, rank: r.rank, owner: r.owner, wallet, sig, url: solscanTx(sig) });
      } catch (e: any) { await sql`update airdrops set status='failed', error=${String(e.message).slice(0, 300)} where id=${ins[0].id}`; out.push({ period, key, rank: r.rank, error: e.message }); }
    }
  }
  return out;
}
export async function airdropHistory(limit = 30) { return sql`select * from airdrops order by ts desc limit ${limit}`; }
export async function feed(limit = 30) { return ((await redis().lrange(`${NS}:feed`, 0, limit - 1)) as any[]).map(x => typeof x === "string" ? JSON.parse(x) : x); }
export const _cfg = cfg;

/** OHLC candles (SOL per token) from indexed on-chain curve trades. */
export async function candles(mint: string, sec = 60, limit = 300) {
  const rows = await sql`select floor(extract(epoch from ts)/${sec})*${sec} as t, (array_agg(price order by ts, sig))[1] o, max(price) h, min(price) l, (array_agg(price order by ts desc, sig desc))[1] c, sum(lamports)::float8/1e9 v, sum(case when side='buy' then lamports else 0 end)::float8/1e9 bv, count(*)::int n from curve_trades where mint=${mint} and price is not null group by 1 order by 1 desc limit ${limit}`;
  return rows.reverse().map((r: any) => ({ time: Number(r.t), open: +r.o, high: +r.h, low: +r.l, close: +r.c, volume: +r.v, buyVolume: +r.bv, trades: r.n }));
}
export async function trades(mint: string, limit = 40) { return sql`select sig, side, lamports::float8/1e9 sol, tokens::float8 tokens, price::float8 price, trader, ts from curve_trades where mint=${mint} order by ts desc limit ${limit}`; }
export async function volumeStats(mint: string) { const [r] = await sql`select coalesce(sum(lamports) filter (where ts > now() - interval '24 hours'),0)::float8/1e9 v24, coalesce(sum(lamports) filter (where ts > now() - interval '1 hour'),0)::float8/1e9 v1, count(*) filter (where ts > now() - interval '24 hours')::int n24, coalesce(sum(lamports),0)::float8/1e9 vall from curve_trades where mint=${mint}`; return r; }
