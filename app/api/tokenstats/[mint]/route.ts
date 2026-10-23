import { sql } from "@/lib/db";
import { limitIp } from "@/lib/ratelimit";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
/** pump.fun-style stats per window (5m/1h/6h/24h) from indexed devnet trades, ATH price, and community comments mentioning $TICKER. */
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const { mint } = await params; const W: [string, string][] = [["5m", "5 minutes"], ["1h", "1 hour"], ["6h", "6 hours"], ["24h", "24 hours"]];
  const windows: Record<string, any> = {};
  await Promise.all(W.map(async ([k, iv]) => {
    const [r] = await sql`select count(*) filter (where side='buy')::int buys, count(*) filter (where side='sell')::int sells,
      coalesce(sum(lamports) filter (where side='buy'),0)::float8/1e9 buy_vol, coalesce(sum(lamports) filter (where side='sell'),0)::float8/1e9 sell_vol,
      count(distinct trader) filter (where side='buy')::int buyers, count(distinct trader) filter (where side='sell')::int sellers, count(distinct trader)::int traders,
      (select price::float8 from curve_trades where mint=${mint} and price is not null and ts <= now() - ${iv}::interval order by ts desc limit 1) p_before,
      (select price::float8 from curve_trades where mint=${mint} and price is not null and ts > now() - ${iv}::interval order by ts asc limit 1) p_first
      from curve_trades where mint=${mint} and ts > now() - ${iv}::interval`.catch(() => [null]);
    windows[k] = r ? { ...r, open: r.p_before ?? r.p_first ?? null } : null;
  }));
  const [ath] = await sql`select max(price)::float8 p from curve_trades where mint=${mint}`.catch(() => [{ p: null }]);
  const [l] = await sql`select ticker from launches where mint=${mint}`.catch(() => [] as any[]);
  const rows: any[] = l ? await sql`select id, body, created_at, author_key from posts where body ilike ${"%$" + l.ticker + "%"} or body ilike ${"%" + mint + "%"} order by created_at desc limit 30`.catch(() => []) : [];
  const ppl = rows.length ? await (await import("@/lib/core/social")).who(rows.map(r => r.author_key)).catch(() => new Map()) : new Map();
  const comments = rows.map(r => { const a: any = ppl.get(r.author_key); return { id: r.id, body: r.body, created_at: r.created_at, author: a?.name ?? "user", avatar: a?.avatar ?? null, url: a?.url ?? null }; });
  // Agent calls (A2A broadcast posts kind='call' for this mint) with the curve/pool price at call time (last real trade at or before the call).
  const cr: any[] = await sql`select p.id, p.body, p.created_at, p.author_key, p.call->>'side' side,
      (select price::float8 from curve_trades t where t.mint=${mint} and t.price is not null and t.ts <= p.created_at order by t.ts desc limit 1) p_at,
      (select price::float8 from curve_trades t where t.mint=${mint} and t.price is not null order by t.ts asc limit 1) p_first
    from posts p where p.kind='call' and p.call->>'mint'=${mint} order by p.created_at desc limit 30`.catch(() => []);
  const cp = cr.length ? await (await import("@/lib/core/social")).who(cr.map(r => r.author_key)).catch(() => new Map()) : new Map();
  const calls = cr.map(r => { const a: any = cp.get(r.author_key); return { id: r.id, body: r.body, side: r.side, created_at: r.created_at, price_at: r.p_at ?? r.p_first ?? null, author: a?.name ?? "agent", handle: a?.handle ?? null, avatar: a?.avatar ?? null, url: a?.url ?? null }; });
  return Response.json({ windows, ath: ath?.p ?? null, comments, calls }, { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
}
