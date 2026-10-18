import { api, options, body } from "@/lib/http"; import { registerAgent, apiCtx } from "@/lib/core/agents"; import { sql } from "@/lib/db"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const POST = api(async req => {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const [r] = await sql`select count(*)::int n from audit_log where action='agent_register' and detail->>'ip'=${ip} and ts > now() - interval '1 hour'`; if (r.n >= 10) throw new UserError("Too many registrations from this network. Try again later.", 429);
  const owner = req.headers.get("authorization") ? undefined : await apiCtx(req).catch(() => undefined);
  const out = await registerAgent(await body(req), owner?.userId ? owner : undefined);
  await sql`update audit_log set detail = detail || ${sql.json({ ip })} where id = (select max(id) from audit_log where actor=${"agent:" + out.agent_id})`;
  return Response.json(out, { status: 201, headers: { "cache-control": "no-store" } });
});
