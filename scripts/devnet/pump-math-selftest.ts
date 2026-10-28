// No-network self test: npx tsx scripts/devnet/pump-math-selftest.ts
import assert from "node:assert";
import * as P from "../../lib/pump";
assert.equal(P.feeCeil(1n, 95), 1n);
assert.equal(P.feeCeil(10_000n, 95), 95n);
const vQ = P.INIT_VIRTUAL_SOL_DEVNET, vT = P.INIT_VIRTUAL_TOKEN;
const { quote } = P.buyQuoteForTokens(1_000_000n, vQ, vT);
assert.equal(quote, (1_000_000n * vQ) / (vT - 1_000_000n) + 1n);
const a = P.tokensForQuote(100_000_000n, vQ, vT);
assert.ok(P.buyQuoteForTokens(a, vQ, vT).quote <= 100_000_000n);
assert.ok(P.buyQuoteForTokens(a + 10_000_000n, vQ, vT).quote > 100_000_000n);
assert.ok(P.sellQuoteForTokens(a, vQ + 100_000_000n, vT - a) <= 100_000_000n);
const g = { initialVirtualSolReserves: vQ, initialVirtualTokenReserves: vT, initialRealTokenReserves: P.INIT_REAL_TOKEN };
const pv = P.previewLaunchBuy({ global: g, feeBps: { protocolBps: 95, creatorBps: 30 }, solIn: 100_000_000n });
assert.ok(pv.totalCost <= 100_000_000n);
console.log("preview 0.1 SOL devnet:", { ...pv, tokensOut: pv.tokensOut.toString(), quote: pv.quote.toString(), protocolFee: pv.protocolFee.toString(), creatorFee: pv.creatorFee.toString(), totalCost: pv.totalCost.toString() });
console.log("roundtrip:", P.simulateBuySellRoundTrip(10_000_000n, vQ, vT, 95, 30));
console.log("maxTrade 2% vQ:", P.suggestMaxTradeSol(vQ).toString(), "mark:", P.markPriceFromReserves(vQ, vT), "mcap lamports:", P.mcapQuote(P.TOKEN_TOTAL_SUPPLY, vQ, vT).toString());
console.log("OK");
