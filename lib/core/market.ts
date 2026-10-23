import { PublicKey } from "@solana/web3.js";
import { conn, online } from "@/lib/solana";
import { PUMP_SDK, bondingCurvePda } from "@/lib/solana/pump";
import { sql } from "@/lib/db";
const INIT_REAL = 793_100_000_000_000n; // pump.fun initial real token reserves (6 decimals)
export type Coin = { mint: string; name: string; ticker: string; logo_cid: string | null; fee_label: string | null; creator: string | null; recipient: string | null; is_holder_reward: boolean; pair: string; launched_at: Date; progress: number; complete: boolean; mcapQuote: number | null; raisedQuote: number; mcapUsd?: number | null };
const g = globalThis as any; g.__mk ??= new Map<string, { t: number; v: any }>();
export async function curveStates(mints: string[]) { return curves(mints); }
async function curves(mints: string[]) {
  const out = new Map<string, any>(); const need = mints.filter(m => { const c = g.__mk.get(m); if (c && Date.now() - c.t < 30_000) { out.set(m, c.v); return false; } return true; });
  for (let i = 0; i < need.length; i += 100) {
    const chunk = need.slice(i, i + 100);
    const infos = await conn().getMultipleAccountsInfo(chunk.map(m => bondingCurvePda(new PublicKey(m)))).catch(() => []);
    infos.forEach((info: any, k: number) => { let v = null; try { if (info) { const bc: any = PUMP_SDK.decodeBondingCurve(info); const vq = Number((bc.virtualQuoteReserves ?? bc.virtualSolReserves).toString()), vt = Number(bc.virtualTokenReserves.toString()); const sold = INIT_REAL - BigInt(bc.realTokenReserves.toString()); v = { complete: bc.complete, progress: bc.complete ? 100 : Math.max(0, Math.min(100, Number(sold * 10000n / INIT_REAL) / 100)), mcapQuote: vt ? (vq / vt) * 1e9 * 1e6 / 1e9 : null, raised: Number((bc.realQuoteReserves ?? bc.realSolReserves).toString()) / 1e9 }; } } catch {} g.__mk.set(chunk[k], { t: Date.now(), v }); out.set(chunk[k], v); });
  }
  const grad = [...out.entries()].filter(([, v]) => v?.complete);
  if (grad.length) { const { poolInfo } = await import("@/lib/core/amm"); await Promise.all(grad.map(async ([m, v]) => { const p = await poolInfo(m).catch(() => null); if (p) { v.mcapQuote = p.priceQuote * 1e9; v.progress = 100; } })); }
  return out;
}
export async function listCoins(opts: { limit?: number; sort?: string; fee?: string; pair?: string; q?: string } = {}): Promise<Coin[]> {
  const rows: any[] = await sql`select l.mint,l.name,l.ticker,l.logo_cid,l.fee_label,l.creator,l.recipient,l.is_holder_reward,l.launched_at, coalesce(p.symbol,'SOL') pair from launches l left join pairs p on p.mint=l.quote_mint where l.mint is not null order by l.launched_at desc limit 200`.catch(() => []);
  const cv = await curves(rows.map(r => r.mint));
  const { solUsd, usdPerQuote } = await import("@/lib/core/price");
  const vq0 = await online().fetchGlobal().then((gl: any) => Number(gl.initialVirtualQuoteReserves?.toString() ?? 0) || null).catch(() => null);
  const [sol, solScale] = await Promise.all([solUsd(), usdPerQuote({ vq0 }).then(x => x.scale)]);
  let list: Coin[] = rows.map(r => { const c = cv.get(r.mint); const mq = c?.mcapQuote ?? null; const per = r.pair === "SOL" ? (sol != null ? sol * solScale : null) : r.pair === "USDC" ? 1 : null; return { ...r, progress: c?.progress ?? 0, complete: !!c?.complete, mcapQuote: mq, raisedQuote: c?.raised ?? 0, mcapUsd: mq != null && per != null ? mq * per : null }; });
  const { fee, pair, q, sort } = opts;
  if (fee) list = list.filter(r => fee === "holders" ? r.is_holder_reward : fee === "x" ? !!r.fee_label?.startsWith("@") : !r.is_holder_reward && !r.fee_label?.startsWith("@"));
  if (pair) list = list.filter(r => r.pair === pair);
  if (q) { const s = q.toLowerCase(); list = list.filter(r => r.name?.toLowerCase().includes(s) || r.ticker?.toLowerCase().includes(s) || r.mint.toLowerCase() === s); }
  if (sort === "mcap" || !sort) list.sort((a, b) => sort ? (b.mcapUsd ?? b.mcapQuote ?? 0) - (a.mcapUsd ?? a.mcapQuote ?? 0) : (b.raisedQuote - a.raisedQuote) || (+b.launched_at - +a.launched_at));
  if (sort === "graduating") list = list.filter(r => !r.complete).sort((a, b) => b.progress - a.progress);
  return list.slice(0, opts.limit ?? 60);
}
export async function stats() {
  const [r] = await sql`select count(*)::int n, count(distinct coalesce(recipient,creator))::int creators from launches where mint is not null`.catch(() => [{ n: 0, creators: 0 }]);
  return r as { n: number; creators: number };
}
export const fmtQ = (n: number | null, sym = "SOL") => n == null ? "—" : `${n >= 1000 ? (n / 1000).toFixed(1) + "K" : n >= 100 ? n.toFixed(0) : n.toFixed(2)} ${sym}`;
export const ago = (d: Date) => { const s = (Date.now() - +new Date(d)) / 1000; return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
export const short = (a?: string | null) => a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "anon";
export const feeTo = (c: Coin) => c.is_holder_reward ? "holders" : c.fee_label?.startsWith("@") ? c.fee_label.split(" ")[0] : "wallet";
