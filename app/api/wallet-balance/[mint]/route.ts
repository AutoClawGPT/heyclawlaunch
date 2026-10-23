import { PublicKey } from "@solana/web3.js";
import { apiCtx } from "@/lib/core/agents";
import { findCustodial } from "@/lib/keystore";
import { conn } from "@/lib/solana";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
/** The signed-in visitor's HeyClawLaunch wallet: real devnet SOL and token balance for the trade panel. */
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params; const no = { headers: { "cache-control": "no-store" } };
  try {
    const ctx = await apiCtx(req); if (!ctx.walletKey) return Response.json({ connected: false }, no);
    const addr = await findCustodial(ctx.walletKey); if (!addr) return Response.json({ connected: true, address: null, sol: 0, tokens: 0 }, no);
    const pk = new PublicKey(addr); const m = new PublicKey(mint);
    const [lam, toks] = await Promise.all([conn().getBalance(pk), conn().getParsedTokenAccountsByOwner(pk, { mint: m }).catch(() => ({ value: [] as any[] }))]);
    const tokens = toks.value.reduce((s: number, a: any) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    return Response.json({ connected: true, address: addr, sol: lam / 1e9, tokens }, no);
  } catch { return Response.json({ connected: false }, no); }
}
