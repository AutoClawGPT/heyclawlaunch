import { limitIp } from "@/lib/ratelimit";
import { previewLaunchBuy } from "@/lib/pump/preview";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
// Launch dev-buy preview (read-only): tokens out, % of supply and total cost incl. protocol + creator fees, from the LIVE
// on-chain pump.fun Global (official SDK fetchGlobal) + pure lib/pump math. GET /api/preview-buy?sol=0.5 or ?tokens=10000000 (whole tokens).
const g = globalThis as any;
export async function GET(req: Request) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const q = new URL(req.url).searchParams; const sol = Number(q.get("sol") ?? ""), tok = Number(q.get("tokens") ?? "");
  if (!(sol > 0 && sol <= 100) && !(tok > 0)) return Response.json({ error: "pass ?sol=<0..100> or ?tokens=<whole tokens>" }, { status: 400 });
  try {
    if (!g.__pgl || Date.now() - g.__pgl.t > 60_000) { const { online } = await import("@/lib/solana"); g.__pgl = { t: Date.now(), v: await online().fetchGlobal() }; }
    const gl: any = g.__pgl.v; const b = (x: any) => BigInt(x.toString());
    const global = { initialVirtualSolReserves: b(gl.initialVirtualQuoteReserves ?? gl.initialVirtualSolReserves), initialVirtualTokenReserves: b(gl.initialVirtualTokenReserves), initialRealTokenReserves: b(gl.initialRealTokenReserves), tokenTotalSupply: b(gl.tokenTotalSupply) };
    const feeBps = { protocolBps: Number(gl.feeBasisPoints?.toString() ?? 95), creatorBps: Number(gl.creatorFeeBasisPoints?.toString() ?? 5) };
    const r = previewLaunchBuy(sol > 0 ? { global, feeBps, solIn: BigInt(Math.round(sol * 1e9)) } : { global, feeBps, tokenOut: BigInt(Math.round(tok)) * 1_000_000n });
    const S = (x: bigint) => Number(x) / 1e9;
    return Response.json({ tokens_out: Number(r.tokensOut) / 1e6, pct_supply: r.pctSupply, quote_sol: S(r.quote), protocol_fee_sol: S(r.protocolFee), creator_fee_sol: S(r.creatorFee), total_cost_sol: S(r.totalCost), fee_bps: feeBps, source: "on-chain Global (devnet) + lib/pump/preview" }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) { return Response.json({ error: String(e?.message ?? e).slice(0, 200) }, { status: 502 }); }
}
