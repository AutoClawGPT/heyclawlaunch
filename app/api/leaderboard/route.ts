import { leaderboard, nextReset, airdropHistory, feed, PRIZES } from "@/lib/core/leaderboard";
import { solscanTx } from "@/lib/config";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const p = (new URL(req.url).searchParams.get("period") ?? "daily") as "daily" | "weekly" | "all";
  const [rows, hist, f] = await Promise.all([leaderboard(p, 25), airdropHistory(20), feed(25).catch(() => [])]);
  return Response.json({ period: p, rows, next: nextReset(), prizes: { daily: PRIZES.daily.map(Number), weekly: PRIZES.weekly.map(Number) }, history: hist.map((h: any) => ({ ...h, url: h.sig ? solscanTx(h.sig) : null })), feed: f });
}
