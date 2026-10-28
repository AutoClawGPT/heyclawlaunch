// Pure bot sizing helpers for thin curves.
import { buyQuoteForTokens, feeCeil, sellQuoteForTokens, tokensForQuote } from "./curve-math";

export interface RoundTripResult { tokens: bigint; buyCost: bigint; sellNet: bigint; lossLamports: bigint; lossPct: number; priceImpactPct: number }

/** Buy with `solIn` (pre-fee quote budget) then immediately sell all tokens. */
export function simulateBuySellRoundTrip(solIn: bigint, vQ: bigint, vT: bigint, protocolBps: number | bigint, creatorBps: number | bigint): RoundTripResult {
  const pb = BigInt(protocolBps), cb = BigInt(creatorBps);
  const tokens = tokensForQuote(solIn, vQ, vT);
  const { quote } = buyQuoteForTokens(tokens, vQ, vT);
  const buyCost = quote + feeCeil(quote, pb) + feeCeil(quote, cb);
  const vQ2 = vQ + quote, vT2 = vT - tokens;
  const gross = sellQuoteForTokens(tokens, vQ2, vT2);
  const sellNet = gross - feeCeil(gross, pb) - feeCeil(gross, cb);
  const loss = buyCost - sellNet;
  const p0 = Number(vQ) / Number(vT), p1 = Number(vQ2) / Number(vT2);
  return { tokens, buyCost, sellNet, lossLamports: loss, lossPct: buyCost ? Number(loss) / Number(buyCost) * 100 : 0, priceImpactPct: (p1 / p0 - 1) * 100 };
}

/** Cap a bot trade at `pctOfVQ` percent of current virtual SOL reserves (default 2%). */
export function suggestMaxTradeSol(vQ: bigint, pctOfVQ = 2): bigint {
  return (vQ * BigInt(Math.round(pctOfVQ * 100))) / 10_000n;
}
