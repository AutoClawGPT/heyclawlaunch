import { api, options } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { inbox } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async req => ({ calls: await inbox(await apiCtx(req)) }));
