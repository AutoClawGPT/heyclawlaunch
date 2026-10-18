import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { runTool } from "@/lib/tools/run"; import { toolDefs, type ToolName } from "@/lib/tools/defs"; import { UserError } from "@/lib/core/validate"; import { NOT_CONNECTED } from "@/lib/core/wallet";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options; export const maxDuration = 60;
const WALLET = new Set(["my_wallet", "claim_fees", "withdraw", "swap"]);
export const POST = api(async (req, { params }) => { const name = (await params).name as ToolName; if (!(name in toolDefs())) throw new UserError(`Unknown tool ${name}. GET /api/v1/tools lists them.`, 404);
  const ctx = await apiCtx(req); if (WALLET.has(name) && !ctx.walletKey) throw new UserError(NOT_CONNECTED(), 401);
  const r = await runTool(ctx, name, await body(req)); return Response.json({ text: r.text, ...(r.data ?? {}), isError: !!r.isError }, { status: r.isError ? 400 : 200 }); });
