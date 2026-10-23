// PumpSwap (pump.fun AMM) support for graduated coins: pool lookup, price, buy and sell.
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { canonicalPumpPoolPda, OnlinePumpAmmSdk, PUMP_AMM_SDK, buyQuoteInput, sellBaseInput } from "@pump-fun/pump-swap-sdk";
import { conn, sendV0 } from "@/lib/solana";

const g = globalThis as any; g.__ammPool ??= new Map<string, { t: number; v: any }>();
export const poolKeyOf = (mint: PublicKey | string) => canonicalPumpPoolPda(new PublicKey(mint));
const sdk = () => (g.__ammSdk ??= new OnlinePumpAmmSdk(conn()));

/** Canonical PumpSwap pool of a graduated coin: reserves (raw units) and price in quote per whole token. Cached 10 s. */
export async function poolInfo(mint: string): Promise<{ pool: string; baseRaw: bigint; quoteRaw: bigint; priceQuote: number; quoteMint: string } | null> {
  const c = g.__ammPool.get(mint); if (c && Date.now() - c.t < 10_000) return c.v;
  let v = null;
  try {
    const pk = poolKeyOf(mint); const p: any = await sdk().fetchPool(pk);
    const [b, q] = await Promise.all([conn().getTokenAccountBalance(p.poolBaseTokenAccount), conn().getTokenAccountBalance(p.poolQuoteTokenAccount)]);
    const baseRaw = BigInt(b.value.amount), quoteRaw = BigInt(q.value.amount);
    const priceQuote = baseRaw > 0n ? (Number(quoteRaw) / 10 ** q.value.decimals) / (Number(baseRaw) / 10 ** b.value.decimals) : 0;
    v = { pool: pk.toBase58(), baseRaw, quoteRaw, priceQuote, quoteMint: p.quoteMint.toBase58() };
  } catch { v = null; }
  g.__ammPool.set(mint, { t: Date.now(), v }); return v;
}

/** Buy a graduated coin with `lamports` of quote (SOL). */
export async function ammBuy(kp: Keypair, mint: PublicKey, lamports: bigint, slip = 10) {
  const st = await sdk().swapSolanaState(poolKeyOf(mint), kp.publicKey);
  const q = new BN(lamports.toString());
  const est = buyQuoteInput({ quote: q, slippage: slip, baseReserve: st.poolBaseAmount, quoteReserve: st.poolQuoteAmount, virtualQuoteReserves: (st.pool as any).virtualQuoteReserves, globalConfig: st.globalConfig, baseMintAccount: st.baseMintAccount, baseMint: st.baseMint, coinCreator: st.pool.coinCreator, creator: st.pool.creator, feeConfig: st.feeConfig, quoteMint: st.pool.quoteMint } as any);
  const ixs = await PUMP_AMM_SDK.buyQuoteInput(st, q, slip);
  g.__ammPool.delete(mint.toBase58());
  return { sig: await sendV0(ixs, [kp]), tokens: BigInt(est.base.toString()) };
}

/** Sell `amount` raw tokens of a graduated coin for quote (SOL). */
export async function ammSell(kp: Keypair, mint: PublicKey, amount: bigint, slip = 10) {
  const st = await sdk().swapSolanaState(poolKeyOf(mint), kp.publicKey);
  const b = new BN(amount.toString());
  const est = sellBaseInput({ base: b, slippage: slip, baseReserve: st.poolBaseAmount, quoteReserve: st.poolQuoteAmount, virtualQuoteReserves: (st.pool as any).virtualQuoteReserves, globalConfig: st.globalConfig, baseMintAccount: st.baseMintAccount, baseMint: st.baseMint, coinCreator: st.pool.coinCreator, creator: st.pool.creator, feeConfig: st.feeConfig, quoteMint: st.pool.quoteMint } as any);
  const ixs = await PUMP_AMM_SDK.sellBaseInput(st, b, slip);
  g.__ammPool.delete(mint.toBase58());
  return { sig: await sendV0(ixs, [kp]), lamports: BigInt(est.uiQuote.toString()) };
}
