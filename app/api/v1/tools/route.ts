import { api, options } from "@/lib/http"; import { toolDefs } from "@/lib/tools/defs"; import { z } from "zod";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async () => ({ tools: Object.entries(toolDefs()).map(([name, d]: any) => ({ name, title: d.title, description: d.description, input: z.toJSONSchema(z.object(d.inputSchema)) })) }));
