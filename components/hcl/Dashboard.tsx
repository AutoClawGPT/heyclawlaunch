"use client";
import Link from "next/link";
import { usePoll, ago } from "./ui";
export default function Dashboard() {
  const [d] = usePoll<any>("/api/dashboard", 5000, null);
  if (!d) return <p className="mt-8 text-[var(--muted)]">Loading…</p>;
  if (!d.orders.length) return <div className="card mt-8 p-8 text-center"><p>No bots yet.</p><Link href="/bots" className="btn-primary mt-4 inline-flex">Order a volume bot</Link></div>;
  return <div className="mt-8 space-y-4">{d.orders.map((o: any) => <div key={o.id} className="card p-5" data-order={o.id}>
    <div className="flex flex-wrap items-center gap-3"><Link href={`/token/${o.mint}`} className="font-semibold hover:text-[var(--accent)]">${o.ticker ?? o.mint.slice(0, 4)}</Link><span className="tag">{o.kind} · {o.package}</span><span className={"tag " + (o.status === "running" || o.status === "queued" ? "tag-strong" : "")}>{o.status === "awaiting_payment" ? "waiting for payment" : o.status}</span><span className="mono ml-auto text-[12px] text-[var(--muted)]">{ago(o.created_at)} ago</span></div>
    <div className="mono mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4"><div>volume <b>{o.volume_sol.toFixed(4)}</b>{o.target_volume_sol ? ` / ${o.target_volume_sol}` : ""} SOL</div><div>trades <b>{o.trades}</b>/{o.max_trades}</div><div>paid {o.price_sol} SOL</div><div>{o.pay_url ? <a className="text-[var(--accent)]" href={o.pay_url} target="_blank">payment tx ↗</a> : "unpaid"}</div></div>
    {o.txs.length > 0 && <ul className="mono mt-3 grid gap-1 text-[12px] sm:grid-cols-2">{o.txs.map((t: any, i: number) => <li key={i} className="flex justify-between gap-2"><span className={t.side === "buy" ? "up" : t.side === "sell" ? "down" : "text-[var(--muted)]"}>{t.side}{t.ok ? "" : " ✗"}</span><span>{t.sol.toFixed(4)} SOL</span>{t.url ? <a href={t.url} target="_blank" className="hover:text-[var(--accent)]">tx ↗</a> : <span>—</span>}</li>)}</ul>}
  </div>)}</div>;
}
