import { limitIp } from "@/lib/ratelimit";
import { sql } from "@/lib/db"; import { currentUser } from "@/lib/auth/session"; import { getClient, redirectAllowed, issueCode, validateAuthz } from "@/lib/auth/oauth";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { { const busy = await limitIp(req, "oauth-a", 30, 60); if (busy) return busy; }
  const f = await req.formData(); const pid = String(f.get("pending") ?? "");
  const [p] = await sql`delete from oauth_pending where id=${pid} and expires_at>now() returning params`;
  if (!p) return new Response("This authorization request expired. Start again from your MCP client.", { status: 400 });
  const params = p.params; const user = await currentUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (validateAuthz(params)) return new Response("Invalid request", { status: 400 });
  const c = await getClient(params.client_id); if (!c || !redirectAllowed(c, params.redirect_uri)) return new Response("Unknown client or redirect_uri", { status: 400 });
  if (f.get("decision") !== "allow") { const u = new URL(params.redirect_uri); u.searchParams.set("error", "access_denied"); if (params.state) u.searchParams.set("state", params.state); return Response.redirect(u.toString(), 303); }
  return new Response(null, { status: 303, headers: { location: await issueCode(params, user.id) } });
}
