import { registerClient } from "@/lib/auth/oauth"; import { json, options } from "@/lib/http";
export const dynamic = "force-dynamic"; export const OPTIONS = options;
export async function POST(req: Request) {
  let body: any; try { body = await req.json(); } catch { return json({ error: "invalid_client_metadata", error_description: "JSON body required" }, 400); }
  const r = await registerClient(body);
  if ("error" in r) return json(r, 400);
  return json({ ...body, client_id: r.client_id, client_id_issued_at: Math.floor(Date.now() / 1000), redirect_uris: r.redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, 201);
}
