import { hasRedis, redis } from "@/lib/redis";
/** Client IP as seen by Vercel's edge (first x-forwarded-for hop). */
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
/** Fixed-window limiter in Upstash. Fails open (no Redis / Redis error) so a cache outage never takes the site down. */
export async function hit(key: string, max: number, windowSec: number): Promise<boolean> {
  if (!hasRedis()) return true;
  try {
    const k = `hcl:rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const n = await redis().incr(k); if (n === 1) await redis().expire(k, windowSec + 5);
    return n <= max;
  } catch { return true; }
}
/** Returns a 429 Response when `req`'s IP is over `max` per `windowSec` for `bucket`, else null. */
export async function limitIp(req: Request, bucket: string, max: number, windowSec = 60): Promise<Response | null> {
  const ip = ipOf(req); if (ip === "local") return null;
  if (await hit(`${bucket}:${ip}`, max, windowSec)) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Slow down and try again in a minute." }), { status: 429, headers: { "content-type": "application/json", "retry-after": String(windowSec), "access-control-allow-origin": "*" } });
}
