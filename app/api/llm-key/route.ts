import { api, options, body } from "@/lib/http"; import { apiCtx, needActor } from "@/lib/core/agents"; import { setLlmKey, llmInfo, PROVIDERS } from "@/lib/core/llm-keys";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async req => ({ ...(await llmInfo(needActor(await apiCtx(req)))), providers: Object.keys(PROVIDERS) }));
export const POST = api(async req => setLlmKey(needActor(await apiCtx(req)), await body(req)));
