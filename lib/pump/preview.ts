// Pure launch-buy preview. No network: pass Global-like values in.
import { TOKEN_TOTAL_SUPPLY } from "./constants";
import { buyQuoteForTokens, feeCeil, tokensForQuote } from "./curve-math";

export interface GlobalLike {
  initialVirtualSolReserves: bigint;
  initialVirtualTokenReserves: bigint;
  initialRealTokenReserves: bigint;
  tokenTotalSupply?: bigint;
}
export interface FeeBps { protocolBps: number | bigint; creatorBps: number | bigint }
export interface PreviewInput { global: GlobalLike; feeBps: FeeBps; solIn?: bigint; tokenOut?: bigint }
export interface PreviewResult { tokensOut: bigint; quote: bigint; protocolFee: bigint; creatorFee: bigint; totalCost: bigint; pctSupply: number }

/** solIn = total lamports the user is willing to spend INCLUDING fees. */
export function previewLaunchBuy({ global, feeBps, solIn, tokenOut }: PreviewInput): PreviewResult {
  const vQ = global.initialVirtualSolReserves, vT = global.initialVirtualTokenReserves;
  const realT = global.initialRealTokenReserves, supply = global.tokenTotalSupply ?? TOKEN_TOTAL_SUPPLY;
  const pb = BigInt(feeBps.protocolBps), cb = BigInt(feeBps.creatorBps);
  let want: bigint;
  if (tokenOut !== undefined) want = tokenOut;
  else if (solIn !== undefined) {
    const budget = (solIn * 10_000n) / (10_000n + pb + cb);
    want = tokensForQuote(budget, vQ, vT);
    // shrink until fees (ceil) fit inside solIn
    for (;;) {
      const { quote } = buyQuoteForTokens(want, vQ, vT, realT);
      if (want <= 0n || quote + feeCeil(quote, pb) + feeCeil(quote, cb) <= solIn) break;
      want = (want * 9999n) / 10000n;
    }
  } else throw new Error("solIn or tokenOut required");
  const { amount, quote } = buyQuoteForTokens(want, vQ, vT, realT);
  const protocolFee = feeCeil(quote, pb), creatorFee = feeCeil(quote, cb);
  return { tokensOut: amount, quote, protocolFee, creatorFee, totalCost: quote + protocolFee + creatorFee,
    pctSupply: Number((amount * 1_000_000n) / supply) / 10_000 };
}
