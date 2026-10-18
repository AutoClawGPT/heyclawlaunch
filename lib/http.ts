export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id", "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate, mcp-protocol-version" };
export const withCors = (r: Response) => { for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => withCors(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } }));
export const options = () => new Response(null, { status: 204, headers: CORS });
