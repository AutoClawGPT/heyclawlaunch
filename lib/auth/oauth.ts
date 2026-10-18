import { randomBytes, createHash } from "crypto";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import { sha } from "@/lib/core/drafts";
export const SCOPES = ["launch", "wallet"];
export const resources = () => [`${cfg.appUrl}/mcp`, `${cfg.appUrl}/mcp/wallet`];
export const ACCESS_TTL = 3600, REFRESH_TTL = 30 * 86400;
export const asMetadata = () => ({
  issuer: cfg.appUrl, authorization_endpoint: `${cfg.appUrl}/oauth/authorize`, token_endpoint: `${cfg.appUrl}/oauth/token`, registration_endpoint: `${cfg.appUrl}/oauth/register`,
  response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"], scopes_supported: SCOPES, client_id_metadata_document_supported: true,
});
export const prMetadata = (path: "/mcp" | "/mcp/wallet") => ({ resource: `${cfg.appUrl}${path}`, authorization_servers: [cfg.appUrl], scopes_supported: SCOPES, bearer_methods_supported: ["header"], resource_name: path === "/mcp" ? cfg.brand : `${cfg.brand} wallet` });

export type Client = { client_id: string; redirect_uris: string[]; client_name?: string };
export async function registerClient(body: any): Promise<Client | { error: string; error_description: string }> {
  const uris: unknown = body?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || !uris.every(u => typeof u === "string" && validRedirect(u))) return { error: "invalid_redirect_uri", error_description: "redirect_uris must be https URLs, http://localhost/127.0.0.1 URLs, or private-use schemes" };
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") return { error: "invalid_client_metadata", error_description: "only public clients (token_endpoint_auth_method none) are supported" };
  const client_id = "hg_" + randomBytes(16).toString("hex");
  await sql`insert into oauth_clients(client_id,redirect_uris,client_name) values(${client_id},${sql.json(uris as string[])},${String(body.client_name ?? "MCP client").slice(0, 100)})`;
  return { client_id, redirect_uris: uris as string[], client_name: body.client_name };
}
function validRedirect(u: string) { try { const x = new URL(u); if (x.hash) return false; if (x.protocol === "https:") return true; if (x.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname); return /^[a-z][a-z0-9+.-]*:$/.test(x.protocol) && !["javascript:", "data:", "file:"].includes(x.protocol); } catch { return false; } }

export async function getClient(clientId: string): Promise<Client | null> {
  if (/^https:\/\//.test(clientId)) { // Client ID Metadata Document
    try {
      const r = await fetch(clientId, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000), redirect: "error" });
      const doc: any = await r.json();
      if (doc.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
      await sql`insert into oauth_clients(client_id,redirect_uris,client_name,metadata_url) values(${clientId},${sql.json(doc.redirect_uris)},${doc.client_name ?? clientId},${clientId}) on conflict(client_id) do update set redirect_uris=excluded.redirect_uris`;
      return { client_id: clientId, redirect_uris: doc.redirect_uris, client_name: doc.client_name };
    } catch { return null; }
  }
  const [c] = await sql`select * from oauth_clients where client_id=${clientId}`;
  return c ? { client_id: c.client_id, redirect_uris: c.redirect_uris, client_name: c.client_name } : null;
}
export function redirectAllowed(c: Client, uri: string) {
  if (c.redirect_uris.includes(uri)) return true;
  try { const u = new URL(uri); if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)) return c.redirect_uris.some(r => { const x = new URL(r); x.port = u.port; return x.toString() === u.toString(); }); } catch {}
  return false; // loopback port variance allowed (RFC 8252 §7.3)
}
export type AuthzParams = { client_id: string; redirect_uri: string; code_challenge: string; code_challenge_method: string; state?: string; scope?: string; resource?: string; response_type: string };
export function validateAuthz(p: Partial<AuthzParams>): string | null {
  if (!p.client_id || !p.redirect_uri) return "Missing client_id or redirect_uri.";
  if (p.response_type !== "code") return "response_type must be code.";
  if (!p.code_challenge || p.code_challenge_method !== "S256") return "PKCE with code_challenge_method=S256 is required.";
  if (p.resource && !resources().includes(p.resource.replace(/\/$/, ""))) return "Unknown resource.";
  return null;
}
export async function issueCode(p: AuthzParams, userId: string) {
  const code = randomBytes(32).toString("base64url");
  const scope = (p.scope ?? "launch wallet").split(/\s+/).filter(s => SCOPES.includes(s)).join(" ") || "launch wallet";
  await sql`insert into oauth_codes values(${sha(code)},${p.client_id},${userId},${p.redirect_uri},${p.code_challenge},${p.resource?.replace(/\/$/, "") ?? `${cfg.appUrl}/mcp/wallet`},${scope},now()+interval '10 minutes',null)`;
  const u = new URL(p.redirect_uri); u.searchParams.set("code", code); if (p.state) u.searchParams.set("state", p.state); u.searchParams.set("iss", cfg.appUrl);
  return u.toString();
}
async function mintTokens(clientId: string, userId: string, resource: string, scope: string) {
  const access = "hga_" + randomBytes(32).toString("base64url"), refresh = "hgr_" + randomBytes(32).toString("base64url");
  await sql`insert into oauth_tokens values(${sha(access)},'access',${clientId},${userId},${resource},${scope},now()+${ACCESS_TTL + " seconds"}::interval,null), (${sha(refresh)},'refresh',${clientId},${userId},${resource},${scope},now()+${REFRESH_TTL + " seconds"}::interval,null)`;
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope };
}
const err = (error: string, error_description: string, status = 400) => ({ status, body: { error, error_description } });
export async function tokenEndpoint(f: URLSearchParams) {
  const gt = f.get("grant_type"), clientId = f.get("client_id");
  if (!clientId) return err("invalid_client", "client_id required", 401);
  if (gt === "authorization_code") {
    const code = f.get("code"), verifier = f.get("code_verifier"), redirect = f.get("redirect_uri");
    if (!code || !verifier) return err("invalid_request", "code and code_verifier required");
    const [c] = await sql`update oauth_codes set used_at=now() where code_hash=${sha(code)} and used_at is null returning *`;
    if (!c || new Date(c.expires_at) < new Date()) return err("invalid_grant", "invalid or expired code");
    if (c.client_id !== clientId) return err("invalid_grant", "client mismatch");
    if (redirect && redirect !== c.redirect_uri) return err("invalid_grant", "redirect_uri mismatch");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (challenge !== c.code_challenge) return err("invalid_grant", "PKCE verification failed");
    const res = f.get("resource")?.replace(/\/$/, ""); if (res && res !== c.resource) return err("invalid_target", "resource mismatch");
    return { status: 200, body: await mintTokens(clientId, c.user_id, c.resource, c.scope) };
  }
  if (gt === "refresh_token") {
    const rt = f.get("refresh_token"); if (!rt) return err("invalid_request", "refresh_token required");
    const [t] = await sql`update oauth_tokens set revoked_at=now() where token_hash=${sha(rt)} and kind='refresh' and revoked_at is null and expires_at>now() returning *`;
    if (!t || t.client_id !== clientId) return err("invalid_grant", "invalid refresh token");
    return { status: 200, body: await mintTokens(clientId, t.user_id, t.resource, t.scope) }; // rotation
  }
  return err("unsupported_grant_type", "use authorization_code or refresh_token");
}
/** Validates a bearer access token for the given resource (audience). Accepts tokens for /mcp or /mcp/wallet on both endpoints (same server). */
export async function verifyAccess(token: string): Promise<{ userId: string; scope: string; resource: string; clientId: string } | null> {
  const [t] = await sql`select * from oauth_tokens where token_hash=${sha(token)} and kind='access' and revoked_at is null and expires_at>now()`;
  if (!t || !resources().includes(t.resource)) return null;
  return { userId: t.user_id, scope: t.scope, resource: t.resource, clientId: t.client_id };
}
