import { limitIp } from "@/lib/ratelimit";
import { leaderboard, nextReset, airdropHistory, feed, PRIZES } from "@/lib/core/leaderboard";
import { solscanTx } from "@/lib/config";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(req: Request) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const p = (new URL(req.url).searchParams.get("period") ?? "daily") as "daily" | "weekly" | "all";
  const [rows, hist, f] = await Promise.all([leaderboard(p, 25), airdropHistory(20), feed(25).catch(() => [])]);
  return Response.json({ period: p, rows, next: nextReset(), prizes: { daily: PRIZES.daily.map(Number), weekly: PRIZES.weekly.map(Number) }, history: hist.map((h: any) => ({ ...h, url: h.sig ? solscanTx(h.sig) : null })), feed: f }, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=60" } });
}
