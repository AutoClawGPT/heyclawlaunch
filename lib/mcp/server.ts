import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { cfg } from "@/lib/config";
import { sql } from "@/lib/db";
import { instructions } from "./instructions";
import { toolDefs, type ToolName } from "@/lib/tools/defs";
import { runTool } from "@/lib/tools/run";
import { verifyAccess } from "@/lib/auth/oauth";
import { ctxForUser, type Ctx } from "@/lib/core/ctx";
import { sha } from "@/lib/core/drafts";
import { NOT_CONNECTED } from "@/lib/core/wallet";
import { agentByKey, agentCtx } from "@/lib/core/agents";

export const SERVER_PROTOCOL = "2025-06-18";
const ACCEPTED = ["2025-06-18", "2025-03-26"];
const WALLET_TOOLS = new Set<ToolName>(["my_wallet", "claim_fees", "withdraw", "swap"]);
const outputSchema = { text: z.string(), draft_id: z.string().optional(), ready: z.boolean().optional(), upload_url: z.string().optional(), mint: z.string().optional(), page_url: z.string().optional(), pump_url: z.string().optional(), create_sig: z.string().optional(), split_sig: z.string().optional(), claim_code: z.string().optional() };

function buildServer(getCtx: () => Ctx) {
  const server = new McpServer({ name: cfg.brand.toLowerCase(), version: "0.1.0" }, { capabilities: { tools: { listChanged: true } }, instructions: instructions() });
  const defs = toolDefs();
  for (const name of Object.keys(defs) as ToolName[]) {
    const d = (defs as any)[name];
    server.registerTool(name, { title: d.title, description: d.description, inputSchema: d.inputSchema, outputSchema, annotations: d.annotations }, async (args: any) => {
      const ctx = getCtx();
      if (WALLET_TOOLS.has(name) && !ctx.walletKey) return { content: [{ type: "text" as const, text: NOT_CONNECTED() }], structuredContent: { text: NOT_CONNECTED() }, isError: true };
      const r = await runTool(ctx, name, args);
      const sc: Record<string, unknown> = { text: r.text };
      for (const k of ["draft_id", "ready", "upload_url", "mint", "page_url", "pump_url", "create_sig", "split_sig", "claim_code"]) if (r.data?.[k] != null) sc[k] = r.data[k];
      return { content: [{ type: "text" as const, text: r.text }], structuredContent: sc, isError: !!r.isError };
    });
  }
  return server;
}

type Sess = { transport: WebStandardStreamableHTTPServerTransport; ctx: Ctx; userId?: string; touched: number };
const g = globalThis as unknown as { __mcpSessions?: Map<string, Sess> };
const sessions = (g.__mcpSessions ??= new Map());
setInterval(() => { const now = Date.now(); for (const [id, s] of sessions) if (now - s.touched > 3600_000) { s.transport.close().catch(() => {}); sessions.delete(id); } }, 600_000).unref?.();

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const rpcErr = (status: number, code: number, message: string) => json(status, { jsonrpc: "2.0", error: { code, message }, id: null });

function originOk(req: Request) {
  const o = req.headers.get("origin"); if (!o) return true; // non-browser clients
  const allowed = (process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean).concat(cfg.appUrl, "https://claude.ai", "https://chatgpt.com", "https://grok.com");
  return allowed.includes(o);
}
function wwwAuth(path: string, error = "invalid_token", desc = "No authorization provided") {
  return `Bearer error="${error}", error_description="${desc}", resource_metadata="${cfg.appUrl}/.well-known/oauth-protected-resource${path}"`;
}
async function resolveCtx(req: Request, path: "/mcp" | "/mcp/wallet"): Promise<Ctx | Response> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const bearer = auth?.match(/^Bearer (.+)$/i)?.[1];
  if (bearer && bearer.startsWith("hcla_")) {
    const a = await agentByKey(bearer);
    if (!a) return json(401, { error: "invalid_token", error_description: "Invalid agent API key" }, { "WWW-Authenticate": wwwAuth(path, "invalid_token", "Invalid agent API key") });
    return agentCtx(a, "mcp", ip);
  }
  if (bearer && bearer.startsWith("hga_")) {
    const t = await verifyAccess(bearer);
    if (!t) return json(401, { error: "invalid_token", error_description: "Invalid or expired token" }, { "WWW-Authenticate": wwwAuth(path, "invalid_token", "Invalid or expired token") });
    const [u] = await sql`select * from users where id=${t.userId} and not banned`;
    if (!u) return json(401, { error: "invalid_token", error_description: "Unknown user" }, { "WWW-Authenticate": wwwAuth(path, "invalid_token", "Unknown user") });
    return { ...ctxForUser(u as any, "mcp"), ip };
  }
  const ck = key ?? (bearer && bearer.startsWith("hgk_") ? bearer : null);
  if (ck) {
    const [u] = await sql`select u.* from connector_keys k join users u on u.id=k.user_id where k.token_hash=${sha(ck)} and k.revoked_at is null`;
    if (u) return { ...ctxForUser(u as any, "mcp"), ip };
    if (path === "/mcp/wallet") return json(401, { error: "invalid_token", error_description: "Invalid connector key" }, { "WWW-Authenticate": wwwAuth(path, "invalid_token", "Invalid connector key") });
  }
  if (path === "/mcp/wallet") return json(401, { error: "invalid_token", error_description: "No authorization provided" }, { "WWW-Authenticate": wwwAuth(path) });
  return { ownerKey: `anon:${sha(ip + "|" + (req.headers.get("user-agent") ?? "")).slice(0, 32)}`, surface: "mcp", ip };
}

export async function handleMcp(req: Request, path: "/mcp" | "/mcp/wallet"): Promise<Response> {
  if (!originOk(req)) return rpcErr(403, -32000, "Forbidden: invalid Origin header.");
  const ctxOrRes = await resolveCtx(req, path);
  if (ctxOrRes instanceof Response) return ctxOrRes;
  const ctx = ctxOrRes;
  // Serverless (Vercel) instances do not share memory, so in-memory sessions break across instances: default to stateless there.
  const stateless = process.env.MCP_STATELESS === "1" || (!!process.env.VERCEL && process.env.MCP_STATELESS !== "0");
  if (req.method === "GET" && stateless) return rpcErr(405, -32000, "Method not allowed.");
  if (req.method === "DELETE" && stateless) return rpcErr(405, -32000, "Method not allowed.");
  const pv = req.headers.get("mcp-protocol-version");
  if (pv && !ACCEPTED.includes(pv) && !(req.method === "POST")) return rpcErr(400, -32000, `Bad Request: Unsupported protocol version ${pv} (supported: ${ACCEPTED.join(", ")}).`);

  let body: any;
  if (req.method === "POST") {
    try { body = await req.json(); } catch { return rpcErr(400, -32700, "Parse error: Invalid JSON"); }
    // Version negotiation: we speak 2025-06-18 (and 2025-03-26). Anything newer is answered with 2025-06-18 per spec.
    const msgs = Array.isArray(body) ? body : [body];
    for (const m of msgs) if (m?.method === "initialize" && m.params && !ACCEPTED.includes(m.params.protocolVersion)) m.params.protocolVersion = SERVER_PROTOCOL;
    if (pv && !ACCEPTED.includes(pv) && !msgs.some(m => m?.method === "initialize")) return rpcErr(400, -32000, `Bad Request: Unsupported protocol version ${pv} (supported: ${ACCEPTED.join(", ")}).`);
  }
  if (stateless) {
    const server = buildServer(() => ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(req, { parsedBody: body });
  }
  const sid = req.headers.get("mcp-session-id");
  if (sid) {
    const s = sessions.get(sid);
    if (!s) return rpcErr(404, -32001, "Session not found");
    if ((s.userId ?? null) !== (ctx.userId ?? ctx.agentId ?? null)) return rpcErr(403, -32000, "Session belongs to another identity.");
    s.touched = Date.now(); s.ctx = ctx;
    const res = await s.transport.handleRequest(req, { parsedBody: body });
    if (req.method === "DELETE") sessions.delete(sid);
    return res;
  }
  if (req.method !== "POST" || !(Array.isArray(body) ? body.some(isInitializeRequest) : isInitializeRequest(body))) return rpcErr(400, -32000, "Bad Request: No valid session ID provided");
  const holder: Sess = { transport: undefined as any, ctx, userId: ctx.userId ?? ctx.agentId, touched: Date.now() };
  holder.transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => { sessions.set(id, holder); },
  });
  holder.transport.onclose = () => { if (holder.transport.sessionId) sessions.delete(holder.transport.sessionId); };
  const server = buildServer(() => holder.ctx);
  await server.connect(holder.transport);
  return holder.transport.handleRequest(req, { parsedBody: body });
}
