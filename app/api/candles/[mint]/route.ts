import { limitIp } from "@/lib/ratelimit";
import { sql } from "@/lib/db";
import { candles, trades, volumeStats } from "@/lib/core/leaderboard";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const IV: Record<string, number> = { "15s": 15, "1m": 60, "5m": 300, "15m": 900, "1h": 3600 };
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const { mint } = await params; const iv = IV[new URL(req.url).searchParams.get("interval") ?? "1m"] ?? 60;
  const [c, t, v] = await Promise.all([candles(mint, iv), trades(mint, 40), volumeStats(mint)]);
  let cs: any[] = c as any[];
  if (!cs.length) { // no trades yet: chart the pump.fun starting price (30 SOL / 1.073B virtual reserves) from launch until now
    const [l] = await sql`select launched_at from launches where mint=${mint}`;
    if (!l) return Response.json({ error: "not launched here" }, { status: 404 });
    const ci: any = await (await import("@/lib/core/coin")).coinInfo(mint).catch(() => null); const p0 = ci?.curve?.priceQuote ?? 0.3 / 1_073_000_000, t0 = Math.floor(+new Date(l.launched_at) / 1000 / iv) * iv, t1 = Math.floor(Date.now() / 1000 / iv) * iv;
    cs = [{ time: t0, open: p0, high: p0, low: p0, close: p0, volume: 0 }, ...(t1 > t0 ? [{ time: t1, open: p0, high: p0, low: p0, close: p0, volume: 0 }] : [])];
  }
  const g = globalThis as any; if (!g.__vq0 || Date.now() - g.__vq0.t > 300_000) { const { online } = await import("@/lib/solana"); const gl: any = await online().fetchGlobal().catch(() => null); g.__vq0 = { t: Date.now(), v: gl ? Number(gl.initialVirtualQuoteReserves?.toString() ?? 0) || null : g.__vq0?.v ?? null }; }
  const [pr] = await sql`select coalesce(p.symbol,'SOL') pair from launches l left join pairs p on p.mint=l.quote_mint where l.mint=${mint}`.catch(() => [] as any[]);
  const { usdPerQuote } = await import("@/lib/core/price"); const pq = await usdPerQuote({ vq0: pr?.pair === "SOL" || !pr ? g.__vq0.v : null, quote: pr?.pair ?? "SOL" });
  const usd_per_quote = pq.usd != null ? pq.usd * pq.scale : null;
  return Response.json({ candles: cs, usd_per_quote, quote: pr?.pair ?? "SOL", scaled: pq.scale !== 1, initial: !(c as any[]).length, trades: t, stats: v }, { headers: { "cache-control": "public, s-maxage=3, stale-while-revalidate=20" } });
}
