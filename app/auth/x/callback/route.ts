import { cookies } from "next/headers";
import { cfg } from "@/lib/config";
import { currentUser, upsertXUser, createSession, sessionCookie } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const raw = (await cookies()).get("hg_xoauth")?.value;
  if (!raw) return new Response("Login expired, try again.", { status: 400 });
  const st = JSON.parse(decodeURIComponent(raw));
  if (q.get("state") !== st.state || !q.get("code")) return new Response("Invalid state.", { status: 400 });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (process.env.X_CLIENT_SECRET) headers.authorization = "Basic " + Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const tok: any = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers, body: new URLSearchParams({ grant_type: "authorization_code", code: q.get("code")!, redirect_uri: `${cfg.appUrl}/auth/x/callback`, code_verifier: st.verifier, client_id: process.env.X_CLIENT_ID! }) }).then(r => r.json());
  if (!tok.access_token) return new Response("X login failed.", { status: 400 });
  const me: any = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", { headers: { authorization: `Bearer ${tok.access_token}` } }).then(r => r.json());
  if (!me?.data?.id) return new Response("X login failed.", { status: 400 });
  const u = await upsertXUser(me.data.id, me.data.username, me.data.profile_image_url ?? null, await currentUser());
  const s = await createSession(u.id);
  return new Response(null, { status: 302, headers: [["location", st.ret], ["set-cookie", sessionCookie(s)], ["set-cookie", "hg_xoauth=; Path=/; Max-Age=0"]] as any });
}
