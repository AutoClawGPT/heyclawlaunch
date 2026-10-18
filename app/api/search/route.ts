import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const rows = q ? await sql`select l.mint,l.name,l.ticker,l.logo_cid,p.symbol pair from launches l left join pairs p on p.mint=l.quote_mint where l.name ilike ${"%" + q + "%"} or l.ticker ilike ${"%" + q + "%"} or l.mint=${q} order by launched_at desc limit 20` : [];
  return Response.json({ tokens: rows.map((r: any) => ({ token: r.mint, name: r.name, ticker: r.ticker, logo: r.logo_cid ? `/api/ipfs/${r.logo_cid}` : null, pair: r.pair ?? "SOL", mc: null })) });
}
