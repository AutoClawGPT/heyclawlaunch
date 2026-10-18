import { api, options } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { sql } from "@/lib/db"; import { solscanTx } from "@/lib/config";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
/** The caller's bot orders with live status and the real volume / trades / txs they produced. */
export const GET = api(async req => {
  const ctx = await apiCtx(req); const keys = [ctx.walletKey, ctx.ownerKey, ctx.agentId ? "agent:" + ctx.agentId : null].filter(Boolean) as string[];
  const orders = await sql`select o.*, l.ticker, l.name, (select coalesce(sum(lamports),0)::bigint from bot_txs t where t.order_id=o.id and t.ok and t.side in ('buy','sell')) vol, (select count(*)::int from bot_txs t where t.order_id=o.id and t.ok and t.side in ('buy','sell')) ntx from bot_orders o left join launches l on l.mint=o.mint where o.owner_key = any(${keys}) order by o.created_at desc limit 50`;
  const ids = orders.map((o: any) => o.id);
  const txs = ids.length ? await sql`select order_id, side, lamports, sig, ok, ts from bot_txs where order_id = any(${ids}) order by ts desc limit 300` : [];
  return { signedIn: !!ctx.walletKey, orders: orders.map((o: any) => ({ id: o.id, mint: o.mint, ticker: o.ticker, name: o.name, kind: o.kind, package: o.package, status: o.status, price_sol: Number(o.price_lamports) / 1e9, target_volume_sol: Number(o.target_volume_lamports) / 1e9, volume_sol: Number(o.vol) / 1e9, trades: o.ntx, max_trades: o.max_trades, pay_sig: o.pay_sig, pay_url: o.pay_sig ? solscanTx(o.pay_sig) : null, created_at: o.created_at,
    txs: txs.filter((t: any) => t.order_id === o.id).slice(0, 12).map((t: any) => ({ side: t.side, sol: Number(t.lamports) / 1e9, ok: t.ok, ts: t.ts, url: t.sig ? solscanTx(t.sig) : null })) })) };
});
