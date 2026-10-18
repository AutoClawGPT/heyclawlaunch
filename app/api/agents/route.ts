import { api, options } from "@/lib/http"; import { listAgents } from "@/lib/core/agents";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async req => { const s = new URL(req.url).searchParams.get("sort") as any; return { agents: await listAgents(["new", "volume", "followers"].includes(s) ? s : "new") }; });
