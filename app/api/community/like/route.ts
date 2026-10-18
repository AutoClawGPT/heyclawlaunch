import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { toggleLike } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const POST = api(async req => toggleLike(await apiCtx(req), Number((await body(req)).post_id)));
