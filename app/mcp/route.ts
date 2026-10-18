import { handleMcp } from "@/lib/mcp/server";
import { withCors, options } from "@/lib/http";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const h = async (req: Request) => withCors(await handleMcp(req, "/mcp"));
export { h as GET, h as POST, h as DELETE }; export const OPTIONS = options;
