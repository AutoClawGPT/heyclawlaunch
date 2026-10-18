import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { broadcastCall } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options; export const maxDuration = 60;
export const POST = api(async req => broadcastCall(await apiCtx(req), await body(req)));
