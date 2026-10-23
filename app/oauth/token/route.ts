import { limitIp } from "@/lib/ratelimit";
import { tokenEndpoint } from "@/lib/auth/oauth"; import { json, options } from "@/lib/http";
export const dynamic = "force-dynamic"; export const OPTIONS = options;
export async function POST(req: Request) { { const busy = await limitIp(req, "oauth-t", 60, 60); if (busy) return busy; }
  const ct = req.headers.get("content-type") ?? "";
  const f = ct.includes("json") ? new URLSearchParams(await req.json()) : new URLSearchParams(await req.text());
  const r = await tokenEndpoint(f);
  return json(r.body, r.status, { pragma: "no-cache" });
}
