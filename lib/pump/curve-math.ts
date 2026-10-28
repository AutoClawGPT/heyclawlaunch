// Pure bigint pump.fun bonding-curve math (see pumpfun-source/EXTRACTED.md).
import { BPS_DENOM } from "./constants";

export interface CurveReserves { vQ: bigint; vT: bigint; realT: bigint }

/** ceil(amount * bps / 10000) — fee_math.rs */
export function feeCeil(amount: bigint, bps: bigint | number): bigint {
  const b = BigInt(bps);
  if (amount <= 0n || b <= 0n) return 0n;
  return (amount * b + BPS_DENOM - 1n) / BPS_DENOM;
}

/** Quote (lamports, pre-fee) to buy `amount` raw tokens: floor(a*vQ/(vT-a))+1. Clamps to realT if given. */
export function buyQuoteForTokens(amount: bigint, vQ: bigint, vT: bigint, realT?: bigint): { amount: bigint; quote: bigint } {
  let a = amount;
  if (realT !== undefined && a > realT) a = realT;
  if (a <= 0n) return { amount: 0n, quote: 0n };
  if (a >= vT) throw new Error("amount >= vT");
  return { amount: a, quote: (a * vQ) / (vT - a) + 1n };
}

/** Gross quote (lamports, pre-fee) for selling `amount`: floor(a*vQ/(vT+a)). */
export function sellQuoteForTokens(amount: bigint, vQ: bigint, vT: bigint): bigint {
  if (amount <= 0n) return 0n;
  return (amount * vQ) / (vT + amount);
}

/** Max tokens for a pre-fee quote budget (inverse of buy formula, conservative). */
export function tokensForQuote(quote: bigint, vQ: bigint, vT: bigint): bigint {
  if (quote <= 1n) return 0n;
  const q = quote - 1n;
  let a = (q * vT) / (vQ + q);
  while (a > 0n && buyQuoteForTokens(a, vQ, vT).quote > quote) a -= 1n;
  return a;
}

/** Spot price in lamports per raw token as a float (display only). */
export function markPrice(vQ: bigint, vT: bigint): number {
  return vT === 0n ? 0 : Number(vQ) / Number(vT);
}

/** Market cap in quote base units: supply*vQ/vT (fee_cpi.rs). */
export function mcapQuote(supply: bigint, vQ: bigint, vT: bigint): bigint {
  return vT === 0n ? 0n : (supply * vQ) / vT;
}
