// Short-lived Deepgram token for the browser voice agent. The API key never leaves the server.
import { cookies } from "next/headers";
import { hasRedis, redis } from "@/lib/redis";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const key = process.env.DEEPGRAM_API_KEY; if (!key) return Response.json({ error: "Voice is not configured." }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const anon = (await cookies()).get("hg_anon")?.value ?? ip;
  if (hasRedis()) { const k = `hcl:voice:${anon}:${new Date().toISOString().slice(0, 13)}`; const n = await redis().incr(k); if (n === 1) await redis().expire(k, 3700); if (n > 30) return Response.json({ error: "Voice limit reached, try again later." }, { status: 429 }); }
  const r = await fetch("https://api.deepgram.com/v1/auth/grant", { method: "POST", headers: { Authorization: `Token ${key}`, "content-type": "application/json" }, body: JSON.stringify({ ttl_seconds: 60 }) });
  if (!r.ok) return Response.json({ error: "Voice is unavailable right now." }, { status: 502 });
  const j = await r.json();
  return Response.json({ token: j.access_token, expires_in: j.expires_in }, { headers: { "cache-control": "no-store" } });
}
