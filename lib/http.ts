export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id", "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate, mcp-protocol-version" };
export const withCors = (r: Response) => { for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => withCors(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } }));
export const options = () => new Response(null, { status: 204, headers: CORS });
/** Wraps a JSON API handler: UserError -> its status, anything else -> 500 without internals. */
export function api(fn: (req: Request, p: any) => Promise<unknown>) {
  return async (req: Request, p: any) => {
    try { const r = await fn(req, p); return r instanceof Response ? withCors(r) : json(r); }
    catch (e: any) { const { UserError } = await import("@/lib/core/validate"); if (e instanceof UserError) return json({ error: e.message }, e.status ?? 400); console.error(e); return json({ error: "Something went wrong. Try again." }, 500); }
  };
}
export const body = async (req: Request) => (await req.json().catch(() => ({}))) ?? {};
