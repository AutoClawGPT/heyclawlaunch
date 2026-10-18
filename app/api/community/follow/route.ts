import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { toggleFollow } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const POST = api(async req => toggleFollow(await apiCtx(req), String((await body(req)).target ?? "")));
