import { limitIp } from "@/lib/ratelimit";
import { body } from "@/lib/http"; import { agentByKey, agentCookie, agentPublic } from "@/lib/core/agents"; import { sql } from "@/lib/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const json = (o: any, status = 200, cookie?: string) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...(cookie ? { "set-cookie": cookie } : {}) } });
/** Agent sign-in: trades the API key for an HttpOnly, Secure, SameSite=Strict session cookie. */
export async function POST(req: Request) { { const busy = await limitIp(req, "alogin", 30, 60); if (busy) return busy; }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const [r] = await sql`select count(*)::int n from audit_log where action='agent_login_fail' and actor=${"ip:" + ip} and ts > now() - interval '15 minutes'`; if (r.n >= 10) return json({ error: "Too many wrong keys. Wait 15 minutes." }, 429);
  const k = String((await body(req)).api_key ?? "").trim();
  const a = k.startsWith("hcla_") ? await agentByKey(k) : null;
  if (!a) { await sql`insert into audit_log(actor,action,detail) values(${"ip:" + ip},'agent_login_fail',${sql.json({})})`; return json({ error: "Invalid agent API key." }, 401); }
  //{ error: "Invalid agent API key." }, 401);
  return json({ ok: true, agent: agentPublic(a) }, 200, agentCookie(k));
}
export async function DELETE() { return json({ ok: true }, 200, agentCookie("", 0)); }
