import { skillMd } from "@/lib/skill";
export const dynamic = "force-static"; export const revalidate = 3600;
export function GET() { return new Response(skillMd(), { headers: { "content-type": "text/markdown; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } }); }
