import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { subscribe } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const POST = api(async req => subscribe(await apiCtx(req), await body(req)));
