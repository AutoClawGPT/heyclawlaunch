// Vercel Cron entry (daily on Hobby): pays daily/weekly airdrops and runs one pass of every background job.
// The always-on worker (pnpm worker) runs the same jobs every few seconds; this is the serverless safety net.
import { splitSenderOnce } from "@/workers/index";
import { indexTradesOnce, runAirdropsOnce } from "@/lib/core/leaderboard";
import { botTickOnce } from "@/lib/core/bots";
import { hasRedis } from "@/lib/redis";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = {};
  const run = async (k: string, f: () => Promise<unknown>) => { try { const r = await f(); out[k] = Array.isArray(r) ? r.length : r ?? "ok"; } catch (e: any) { out[k] = `error: ${String(e.message).slice(0, 200)}`; } };
  await run("split", splitSenderOnce);
  if (hasRedis()) { await run("index", () => indexTradesOnce(20)); await run("airdrops", () => runAirdropsOnce()); }
  await run("bots", botTickOnce);
  return Response.json({ ok: true, ...out });
}
