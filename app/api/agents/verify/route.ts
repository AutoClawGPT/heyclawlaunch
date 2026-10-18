import { api, options, body } from "@/lib/http"; import { apiCtx, verifyAgent } from "@/lib/core/agents";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const POST = api(async req => verifyAgent(await apiCtx(req), (await body(req)).post_url));
