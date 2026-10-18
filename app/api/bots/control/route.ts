import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { sql } from "@/lib/db"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
/** Stop or resume one of your own bot orders. */
export const POST = api(async req => {
  const ctx = await apiCtx(req); const b = await body(req);
  const keys = [ctx.walletKey, ctx.ownerKey, ctx.agentId ? "agent:" + ctx.agentId : null].filter(Boolean) as string[];
  if (!keys.length) throw new UserError("Sign in first.", 401);
  const [o] = await sql`select * from bot_orders where id::text=${String(b.order_id ?? "")} and owner_key = any(${keys})`; if (!o) throw new UserError("Order not found.", 404);
  if (b.action === "stop") { if (!["queued", "running"].includes(o.status)) throw new UserError(`Bot is ${o.status}.`); await sql`update bot_orders set status='paused', updated_at=now() where id=${o.id}`; return { status: "paused" }; }
  if (b.action === "resume") { if (o.status !== "paused") throw new UserError(`Bot is ${o.status}, not paused.`); await sql`update bot_orders set status='queued', updated_at=now() where id=${o.id}`; return { status: "queued" }; }
  throw new UserError('action must be "stop" or "resume".');
});
