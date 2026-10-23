import { sql } from "@/lib/db";
export type CoinStat = { v24: number; n24: number; buys: number; sells: number; open24: number | null; spark: number[]; replies: number; callers: { name: string; avatar: string | null }[]; calls: number };
/** 24h volume/txns, 24h-open price and an hourly close sparkline (quote per token) for many mints in one query (indexed devnet curve trades). */
export async function coinStats(mints: string[]): Promise<Map<string, CoinStat>> {
  const out = new Map<string, CoinStat>(); if (!mints.length) return out;
  const rows: any[] = await sql`select mint,
      coalesce(sum(lamports) filter (where ts > now() - interval '24 hours'),0)::float8/1e9 v24,
      count(*) filter (where ts > now() - interval '24 hours')::int n24,
      count(*) filter (where ts > now() - interval '24 hours' and side='buy')::int buys,
      count(*) filter (where ts > now() - interval '24 hours' and side='sell')::int sells,
      (array_agg(price::float8 order by ts desc) filter (where ts <= now() - interval '24 hours' and price is not null))[1] p_before,
      (array_agg(price::float8 order by ts asc) filter (where ts > now() - interval '24 hours' and price is not null))[1] p_first
    from curve_trades where mint = any(${mints}) group by mint`.catch(() => []);
  const sp: any[] = await sql`select mint, date_trunc('hour', ts) h, (array_agg(price::float8 order by ts desc))[1] p from curve_trades where mint = any(${mints}) and price is not null and ts > now() - interval '48 hours' group by mint, h order by mint, h`.catch(() => []);
  const rp: any[] = await sql`select l.mint, count(p.*)::int n from launches l join posts p on p.body ilike '%$' || l.ticker || '%' where l.mint = any(${mints}) group by l.mint`.catch(() => []);
  for (const m of mints) out.set(m, { v24: 0, n24: 0, buys: 0, sells: 0, open24: null, spark: [], replies: 0, callers: [], calls: 0 });
  for (const r of rows) Object.assign(out.get(r.mint)!, { v24: r.v24, n24: r.n24, buys: r.buys, sells: r.sells, open24: r.p_before ?? r.p_first ?? null });
  for (const r of sp) out.get(r.mint)?.spark.push(r.p);
  for (const r of rp) { const o = out.get(r.mint); if (o) o.replies = r.n; }
  const cl: any[] = await sql`select call->>'mint' mint, author_key, count(*)::int n from posts where kind='call' and call->>'mint' = any(${mints}) group by 1, 2 order by max(created_at) desc`.catch(() => []);
  if (cl.length) { const ppl = await (await import("@/lib/core/social")).who(cl.map(r => r.author_key)).catch(() => new Map());
    for (const r of cl) { const o = out.get(r.mint); const a: any = ppl.get(r.author_key); if (o) { o.calls += r.n; o.callers.push({ name: a?.name ?? "agent", avatar: a?.avatar ?? null }); } } }
  return out;
}
