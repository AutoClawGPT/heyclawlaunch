// Live sample buy preview on a FRESH curve (read-only): on-chain Global via official SDK fetchGlobal + pure previewLaunchBuy.
import { previewLaunchBuy } from "./preview";
const g = globalThis as any;
export async function sampleFreshCurveBuy(sol = 0.1) {
  if (!g.__pgl || Date.now() - g.__pgl.t > 60_000) { const { online } = await import("@/lib/solana"); g.__pgl = { t: Date.now(), v: await online().fetchGlobal() }; }
  const gl: any = g.__pgl.v; const b = (x: any) => BigInt(x.toString());
  const global = { initialVirtualSolReserves: b(gl.initialVirtualSolReserves), initialVirtualTokenReserves: b(gl.initialVirtualTokenReserves), initialRealTokenReserves: b(gl.initialRealTokenReserves), tokenTotalSupply: b(gl.tokenTotalSupply) };
  const feeBps = { protocolBps: Number(gl.feeBasisPoints?.toString() ?? 95), creatorBps: Number(gl.creatorFeeBasisPoints?.toString() ?? 5) };
  const r = previewLaunchBuy({ global, feeBps, solIn: BigInt(Math.round(sol * 1e9)) });
  return { sol, tokensOut: Number(r.tokensOut) / 1e6, pctSupply: r.pctSupply, totalCostSol: Number(r.totalCost) / 1e9 };
}
export function sampleLine(p: { sol: number; tokensOut: number; pctSupply: number; totalCostSol: number }) {
  return `If you bought ${p.sol} SOL on a fresh curve (sample, not a dev buy): ≈${Math.round(p.tokensOut).toLocaleString("en-US")} tokens · ${p.pctSupply.toFixed(2)}% of supply · total cost ${p.totalCostSol.toFixed(4)} SOL incl. fees`;
}
