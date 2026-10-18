import { candles, trades, volumeStats } from "@/lib/core/leaderboard";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const IV: Record<string, number> = { "15s": 15, "1m": 60, "5m": 300, "15m": 900, "1h": 3600 };
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params; const iv = IV[new URL(req.url).searchParams.get("interval") ?? "1m"] ?? 60;
  const [c, t, v] = await Promise.all([candles(mint, iv), trades(mint, 40), volumeStats(mint)]);
  return Response.json({ candles: c, trades: t, stats: v }, { headers: { "cache-control": "no-store" } });
}
