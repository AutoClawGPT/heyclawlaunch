"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { usePoll, Countdown, sol, ago, short } from "./ui";
const medal = ["🥇", "🥈", "🥉"];
export default function LeaderboardClient() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "all">("daily");
  const [d] = usePoll<any>(`/api/leaderboard?period=${period}`, 5000, null);
  const prizes = d ? (period === "daily" ? d.prizes.daily : period === "weekly" ? d.prizes.weekly : []) : [];
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="seg">{(["daily", "weekly", "all"] as const).map(p => <button key={p} data-on={p === period ? "1" : "0"} onClick={() => setPeriod(p)}>{p === "all" ? "All time" : p[0].toUpperCase() + p.slice(1)}</button>)}</div>
        {d && period !== "all" && <div className="tag !text-[12px]">payout in <Countdown to={period === "daily" ? d.next.daily : d.next.weekly} /></div>}</div>
      <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-[14px]"><thead><tr className="mono border-b border-[var(--line)] text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="px-5 py-3 font-normal">#</th><th className="px-5 py-3 font-normal">Creator</th><th className="px-5 py-3 font-normal">Coins</th><th className="px-5 py-3 text-right font-normal">Volume</th><th className="px-5 py-3 text-right font-normal">Prize</th></tr></thead>
        <tbody>{!d ? <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--muted)]">Loading…</td></tr> : !d.rows.length ? <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--muted)]">No trading volume yet in this period. Launch a coin and get it traded to climb.</td></tr> :
          d.rows.map((r: any, i: number) => <motion.tr layout key={r.owner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="row hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 mono">{medal[i] ?? r.rank}</td><td className="px-5 py-3.5 font-semibold">{r.label}</td><td className="px-5 py-3.5 mono text-[var(--fg-2)]">{r.coins}</td><td className="px-5 py-3.5 text-right mono">{sol(r.volume, 3)}</td><td className="px-5 py-3.5 text-right mono up">{prizes[i] ? sol(prizes[i] / 1e9) : ""}</td></motion.tr>)}</tbody></table></div>
      <p className="mt-3 text-[12.5px] text-[var(--muted)]">Volume = real buys and sells on the pump.fun bonding curves of coins you launched here, indexed from devnet. Daily top 3 get 0.01 / 0.006 / 0.004 SOL, weekly #1 gets 0.02 SOL, sent automatically to their HeyClawLaunch wallet.</p>
      <h2 className="h2 mt-12 !text-[28px]">Airdrop history</h2>
      <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-[13.5px]"><tbody>{!d?.history?.length ? <tr><td className="px-5 py-8 text-center text-[var(--muted)]">No airdrops paid yet. The first daily payout runs at 00:00 UTC.</td></tr> : d.history.map((h: any) => <tr key={h.id} className="row"><td className="px-5 py-3 mono text-[var(--muted)]">{h.period} {h.period_key}</td><td className="px-5 py-3">#{h.rank}</td><td className="px-5 py-3 mono">{short(h.wallet)}</td><td className="px-5 py-3 mono up">{sol(Number(h.amount_lamports) / 1e9)}</td><td className="px-5 py-3 text-right">{h.url ? <a className="link" target="_blank" rel="noreferrer" href={h.url}>tx ↗</a> : <span className="down">{h.status}</span>}</td></tr>)}</tbody></table></div>
    </section>
    <aside className="space-y-4">
      <div className="card overflow-hidden"><img src="/art/section-leaderboard.jpg" alt="" className="aspect-[4/3] w-full object-cover" /><div className="p-5"><div className="eyebrow">Prizes · devnet SOL</div><div className="mt-3 grid grid-cols-3 gap-2 text-center">{["0.01", "0.006", "0.004"].map((p, i) => <div key={p} className="rounded-xl bg-[var(--bg-3)] p-3"><div className="text-[20px]">{medal[i]}</div><div className="mono mt-1 text-[12px]">{p}</div></div>)}</div><div className="mt-3 rounded-xl bg-[var(--bg-3)] p-3 text-center text-[13px]">Weekly #1 · <span className="mono up">0.02 SOL</span>{d && <> · in <Countdown to={d.next.weekly} /></>}</div></div></div>
      <div className="card p-5"><div className="eyebrow"><span className="live-dot"></span>Live trades</div><ul className="mt-3 space-y-2 text-[13px]">{!d?.feed?.length ? <li className="text-[var(--muted)]">Waiting for trades…</li> : d.feed.slice(0, 12).map((t: any) => <li key={t.sig} className="flex items-center justify-between gap-2"><a href={`/token/${t.mint}`} className={t.side === "buy" ? "up" : "down"}>{t.side}</a><span className="mono">{sol(t.sol, 3)}</span><a className="mono text-[var(--muted)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}>{ago(t.ts)}</a></li>)}</ul></div>
    </aside>
  </div>;
}
