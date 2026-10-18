import { PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { conn, online } from "@/lib/solana";
import { UserError } from "./validate";

const KNOWN: Record<string, { symbol: string; name: string }> = {
  So11111111111111111111111111111111111111112: { symbol: "SOL", name: "Solana" },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin" },
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", name: "USD Coin (devnet)" },
};
export const isSolOrUsdc = (p: { symbol: string }) => p.symbol === "SOL" || p.symbol === "USDC";
export type Pair = { mint: string; symbol: string; name: string; decimals: number; source: string; token_program: string; graduation: string; custom_fee_allowed: boolean };

async function tokenMeta(mint: string): Promise<{ symbol: string; name: string } | null> {
  if (KNOWN[mint]) return KNOWN[mint];
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`, { signal: AbortSignal.timeout(5000) });
    const j: any = await r.json(); const t = Array.isArray(j) ? j.find((x: any) => x.id === mint) : null;
    if (t) return { symbol: t.symbol, name: t.name };
  } catch {}
  return null;
}

export async function syncPairs(): Promise<number> {
  const sdk = online();
  const [list, global] = await Promise.all([sdk.fetchSupportedQuoteMints(), sdk.fetchGlobal()]);
  const vT = BigInt(global.initialVirtualTokenReserves.toString()), rT = BigInt(global.initialRealTokenReserves.toString());
  for (const q of list) {
    const mint = q.mint.toBase58();
    const info = await conn().getParsedAccountInfo(q.mint);
    const decimals = (info.value?.data as any)?.parsed?.info?.decimals ?? 9;
    const vQ = BigInt(q.initialVirtualQuoteReserves.toString());
    const raised = (vQ * vT) / (vT - rT) - vQ;
    const graduation = (Number(raised) / 10 ** decimals).toFixed(2);
    const meta = (await tokenMeta(mint)) ?? { symbol: mint.slice(0, 4), name: mint.slice(0, 8) };
    await sql`insert into pairs(mint,symbol,name,decimals,source,token_program,graduation,custom_fee_allowed,synced_at)
      values(${mint},${meta.symbol},${meta.name},${decimals},${q.source},${info.value?.owner.toBase58() ?? ""},${graduation},${!["SOL", "USDC"].includes(meta.symbol)},now())
      on conflict(mint) do update set symbol=excluded.symbol,name=excluded.name,decimals=excluded.decimals,source=excluded.source,token_program=excluded.token_program,graduation=excluded.graduation,custom_fee_allowed=excluded.custom_fee_allowed,synced_at=now()`;
  }
  await sql`delete from pairs where synced_at < now() - interval '1 minute' and mint <> all(${list.map(q => q.mint.toBase58())})`;
  return list.length;
}
export async function getPairs(): Promise<Pair[]> {
  let rows = await sql<Pair[]>`select * from pairs order by (symbol='SOL') desc, (symbol='USDC') desc, symbol`;
  const [{ age }] = await sql`select coalesce(extract(epoch from now()-min(synced_at)),1e9) age from pairs`;
  if (!rows.length || Number(age) > 600) { try { await syncPairs(); rows = await sql<Pair[]>`select * from pairs order by (symbol='SOL') desc, (symbol='USDC') desc, symbol`; } catch (e) { if (!rows.length) throw e; } }
  return rows;
}
export function formatPairs(pairs: Pair[]) {
  return `${pairs.length} pair(s):\n` + pairs.map(p => `- ${p.symbol === "SOL" ? "SOL" : (p.symbol === "USDC" ? "USDC" : "$" + p.symbol)} (${p.name}) — graduates at ~${Number(p.graduation).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${p.symbol === "SOL" || p.symbol === "USDC" ? p.symbol : "$" + p.symbol}${p.custom_fee_allowed ? ", custom creator fee allowed" : ""} — mint ${p.mint}`).join("\n");
}
export async function resolvePair(input: string): Promise<Pair> {
  const pairs = await getPairs(); const s = input.trim().replace(/^\$/, "");
  const hit = pairs.find(p => p.mint === s) ?? pairs.find(p => p.symbol.toLowerCase() === s.toLowerCase()) ?? pairs.find(p => p.symbol.toLowerCase() === (s + "x").toLowerCase()) ?? pairs.find(p => p.name.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  try { new PublicKey(s); } catch { throw new UserError(`"${input}" isn't a supported pair. Use list_pairs to see the options.`); }
  try { await online().resolveQuoteMint(new PublicKey(s)); } catch { throw new UserError(`That mint isn't accepted as a pair by pump.fun.`); }
  return { mint: s, symbol: s.slice(0, 4), name: s, decimals: 6, source: "pumpCoin", token_program: "", graduation: "0", custom_fee_allowed: true };
}
