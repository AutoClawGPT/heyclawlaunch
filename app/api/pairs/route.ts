import { getPairs } from "@/lib/core/pairs";
export const dynamic = "force-dynamic"; const CC = { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } };
export async function GET() { const p = await getPairs(); return Response.json({ count: p.length, pairs: p.map(x => ({ address: x.mint, symbol: x.symbol, name: x.name, decimals: x.decimals, source: x.source, tokenProgram: x.token_program, graduation: x.graduation })) }, CC); }
