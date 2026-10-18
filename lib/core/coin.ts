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
    curve = { complete: bc.complete, creator: bc.creator.toBase58(), realQuote: Number((bc as any).realQuoteReserves ?? (bc as any).realSolReserves.toString()), progress: Math.min(100, Number(sold * 10000n / BigInt(global.initialRealTokenReserves.toString())) / 100), priceQuote: Number(((bc as any).virtualQuoteReserves ?? (bc as any).virtualSolReserves).toString()) / Number(bc.virtualTokenReserves.toString()) / 1000 };
  } catch {}
  try { const s = await readSharingConfig(new PublicKey(mint)); if (s) sc = s.shareholders.map((x: any) => ({ address: x.address.toBase58(), bps: x.shareBps })); } catch {}
  const sigs = await conn().getSignaturesForAddress(bondingCurvePda(new PublicKey(mint)), { limit: 30 }).catch(() => []);
  return { launch: l ?? null, curve, shares: sc, recent: sigs.map(s => ({ sig: s.signature, time: s.blockTime, err: !!s.err })) };
}
