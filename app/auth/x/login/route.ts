import { randomBytes, createHash } from "crypto";
import { cfg } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!process.env.X_CLIENT_ID) return new Response("Sign in with X is not configured on this server (set X_CLIENT_ID). Use wallet sign-in.", { status: 501 });
  const ret = new URL(req.url).searchParams.get("return_to") ?? "/claim";
  const state = randomBytes(16).toString("base64url"), verifier = randomBytes(32).toString("base64url");
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.search = new URLSearchParams({ response_type: "code", client_id: process.env.X_CLIENT_ID, redirect_uri: `${cfg.appUrl}/auth/x/callback`, scope: "users.read tweet.read", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  const ck = `hg_xoauth=${encodeURIComponent(JSON.stringify({ state, verifier, ret: ret.startsWith("/") ? ret : "/claim" }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;
  return new Response(null, { status: 302, headers: { location: u.toString(), "set-cookie": ck } });
}
