import { poolInfo } from "@/lib/core/amm";
import { PublicKey } from "@solana/web3.js";
import { conn, online, readSharingConfig } from "@/lib/solana";
import { bondingCurvePda } from "@/lib/solana/pump";
import { sql } from "@/lib/db";
/** Live on-chain stats for a coin (no indexer needed). */
export async function coinInfo(mint: string) {
  const [l] = await sql`select l.*, p.symbol pair_symbol from launches l left join pairs p on p.mint=l.quote_mint where l.mint=${mint}`;
  let curve: any = null, sc: any = null;
  try { const bc = await online().fetchBondingCurve(new PublicKey(mint)); const global = await online().fetchGlobal();
    const sold = BigInt(global.initialRealTokenReserves.toString()) - BigInt(bc.realTokenReserves.toString());
    curve = { complete: bc.complete, creator: bc.creator.toBase58(), realQuote: Number((bc as any).realQuoteReserves ?? (bc as any).realSolReserves.toString()), progress: Math.min(100, Number(sold * 10000n / BigInt(global.initialRealTokenReserves.toString())) / 100), priceQuote: (Number(((bc as any).virtualQuoteReserves ?? (bc as any).virtualSolReserves).toString()) / 1e9) / (Number(bc.virtualTokenReserves.toString()) / 1e6), vq0: Number((bc as any).initialVirtualQuoteReserves?.toString() ?? global.initialVirtualQuoteReserves?.toString() ?? 30e9), supply: Number(bc.tokenTotalSupply?.toString() ?? 1e15) / 1e6 };
  } catch {}
  if (curve) curve.venue = "curve";
  if (curve?.complete) { // graduated: the live price is on the PumpSwap pool, the curve account is frozen
    const p = await poolInfo(mint).catch(() => null);
    if (p) { curve.venue = "pumpswap"; curve.pool = p.pool; curve.priceQuote = p.priceQuote; curve.poolQuote = Number(p.quoteRaw); curve.progress = 100; }
  }
  if (curve?.priceQuote != null) { // exact devnet on-chain price × live SOL/USD (no scaling)
    const { coinUsd } = await import("@/lib/core/price"); const quote = l?.pair_symbol === "USDC" ? "USDC" : "SOL";
    const u = await coinUsd(mint, curve.priceQuote, { quote }).catch(() => null);
    if (u) { curve.priceUsd = u.priceUsd; curve.mcapUsd = u.mcapUsd; curve.mcapQuote = curve.priceQuote * 1e9; curve.quote = quote; }
  }
  try { const s = await readSharingConfig(new PublicKey(mint)); if (s) sc = s.shareholders.map((x: any) => ({ address: x.address.toBase58(), bps: x.shareBps })); } catch {}
  const sigs = await conn().getSignaturesForAddress(bondingCurvePda(new PublicKey(mint)), { limit: 30 }).catch(() => []);
  return { launch: l ?? null, curve, shares: sc, recent: sigs.map(s => ({ sig: s.signature, time: s.blockTime, err: !!s.err })) };
}
/** Holder count: token accounts of this mint with a non-zero balance (excluding the bonding curve). */
export async function holderCount(mint: string): Promise<number | null> {
  try {
    const { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    let n = 0;
    for (const prog of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
      const accs = await conn().getProgramAccounts(prog, { filters: [{ memcmp: { offset: 0, bytes: mint } }], dataSlice: { offset: 32, length: 40 } });
      const curve = bondingCurvePda(new PublicKey(mint)).toBase58();
      for (const a of accs) { const d = a.account.data; const owner = new PublicKey(d.subarray(0, 32)).toBase58(); const amt = d.readBigUInt64LE(32); if (amt > 0n && owner !== curve) n++; }
    }
    return n;
  } catch {
    try { const top = await conn().getTokenLargestAccounts(new PublicKey(mint)); const curve = bondingCurvePda(new PublicKey(mint)); const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token"); const cAta = getAssociatedTokenAddressSync(new PublicKey(mint), curve, true, TOKEN_2022_PROGRAM_ID).toBase58(); return top.value.filter(a => Number(a.amount) > 0 && a.address.toBase58() !== cAta).length; } catch { return null; }
  }
}
