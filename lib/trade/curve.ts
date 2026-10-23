import { pimlicoEnabled, sponsoredSend } from "@/lib/solana/pimlico";
// Real devnet trades on a pump.fun bonding curve (SOL pair, Token-2022 coins).
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { conn, online, sendV0 } from "@/lib/solana";
import { PUMP_SDK, getBuyV3TokenAmountFromQuoteAmount, getSellSolAmountFromTokenAmount } from "@/lib/solana/pump";

const g = globalThis as any;
async function gf() { const t = Date.now(); if (!g.__gf || t - g.__gf.t > 60_000) { const s = online(); const [global, feeConfig] = await Promise.all([s.fetchGlobal(), s.fetchFeeConfig()]); g.__gf = { t, global, feeConfig }; } return g.__gf; }

export async function buy(kp: Keypair, mint: PublicKey, lamports: bigint, slip = 10) {
  const { global, feeConfig } = await gf(); const st = await online().fetchBuyState(mint, kp.publicKey, TOKEN_2022_PROGRAM_ID);
  if (st.bondingCurve.complete) return (await import("@/lib/core/amm")).ammBuy(kp, mint, lamports, slip); // graduated → PumpSwap
  const out = getBuyV3TokenAmountFromQuoteAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: st.bondingCurve, amount: new BN(lamports.toString()), curveBaseTokenBalance: st.curveBaseTokenBalance });
  const ixs = await PUMP_SDK.buyExactQuoteInV3Instructions({ bondingCurve: st.bondingCurve, associatedUserAccountInfo: st.associatedUserAccountInfo, mint, user: kp.publicKey, amount: out, quoteAmount: new BN(lamports.toString()), slippage: slip, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: st.quoteTokenProgram });
  return { sig: await sendV0(ixs, [kp]), tokens: BigInt(out.toString()) };
}
export async function tokenBalance(owner: PublicKey, mint: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);
  const b = await conn().getTokenAccountBalance(ata).catch(() => null); return BigInt(b?.value.amount ?? "0");
}
export async function sell(kp: Keypair, mint: PublicKey, amount?: bigint, slip = 10) {
  const { global, feeConfig } = await gf(); const amt = amount ?? (await tokenBalance(kp.publicKey, mint));
  if (amt <= 0n) throw new Error("no tokens to sell");
  const ss = await online().fetchSellState(mint, kp.publicKey, TOKEN_2022_PROGRAM_ID);
  if (ss.bondingCurve.complete) return (await import("@/lib/core/amm")).ammSell(kp, mint, amt, slip); // graduated → PumpSwap
  const out = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: ss.bondingCurve, amount: new BN(amt.toString()) });
  const ixs = await PUMP_SDK.sellV3Instructions({ bondingCurve: ss.bondingCurve, mint, user: kp.publicKey, amount: new BN(amt.toString()), quoteAmount: out, slippage: slip, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: ss.quoteTokenProgram });
  return { sig: await sendV0(ixs, [kp]), lamports: BigInt(out.toString()) };
}
export async function sendSol(from: Keypair, to: PublicKey, lamports: bigint) {
  if (pimlicoEnabled()) { try { return await sponsoredSend([SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports })], [from]); } catch (e: any) { console.warn("[pimlico] falling back:", String(e.message).slice(0, 160)); } }
  return sendV0([SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports })], [from]);
}
