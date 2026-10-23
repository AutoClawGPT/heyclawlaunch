import { PublicKey } from "@solana/web3.js";
import { limitIp } from "@/lib/ratelimit";
import { conn } from "@/lib/solana";
import { bondingCurvePda } from "@/lib/solana/pump";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
/** Top holders of a devnet coin (largest token accounts, owners resolved; bonding curve / pool labelled). */
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const { mint } = await params; if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return Response.json({ error: "bad mint" }, { status: 400 });
  try {
    const pk = new PublicKey(mint); const curve = bondingCurvePda(pk).toBase58();
    const [top, sup] = await Promise.all([conn().getTokenLargestAccounts(pk), conn().getTokenSupply(pk)]);
    const accs = top.value.filter(a => Number(a.amount) > 0).slice(0, 20);
    const info = await conn().getMultipleParsedAccounts(accs.map(a => a.address));
    const total = Number(sup.value.amount) || 1;
    const holders = accs.map((a, i) => { const owner = (info.value[i]?.data as any)?.parsed?.info?.owner ?? a.address.toBase58();
      return { owner, amount: Number(a.amount) / 10 ** a.decimals, pct: (Number(a.amount) / total) * 100, label: owner === curve ? "bonding curve" : null }; });
    return Response.json({ holders }, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch { return Response.json({ holders: [], error: "rpc" }, { status: 200, headers: { "cache-control": "public, s-maxage=5" } }); }
}
