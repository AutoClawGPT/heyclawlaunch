"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ipfsImg, ago } from "./ui";
const s = (n: number) => `${Number(n.toFixed(6))} SOL`;
export default function Scanner({ initial, connected }: { initial: string; connected: string | null }) {
  const [w, setW] = useState(initial); const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async (x = w) => { if (!x) return; setBusy(true); setErr(""); try { const r = await fetch(`/api/scan?wallet=${encodeURIComponent(x)}`); const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); history.replaceState(null, "", `/scanner?wallet=${x}`); } catch (e: any) { setErr(e.message); setD(null); } finally { setBusy(false); } };
  // run once on mount for a ?wallet= deep link
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial) go(initial); }, []);
  return (<div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); go(); }}><input className="input mono flex-1 min-w-[260px] !h-12" placeholder="Solana wallet address" value={w} onChange={e => setW(e.target.value.trim())} /><button className="btn-primary !h-12" disabled={busy || !w}>{busy ? "Scanning…" : "Scan"}</button>{connected && connected !== w && <button type="button" className="btn-ghost !h-12" onClick={() => { setW(connected); go(connected); }}>Use my wallet</button>}</form>
    {err && <p className="mt-3 text-[13px] down">{err}</p>}
    {d && <div className="mt-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{[["Launched", d.totals.launched], ["Coins paying it", d.totals.paying_this_wallet], ["Earned", s(d.totals.earned_sol)], ["Claimable", s(d.totals.claimable_sol)], ["Claimed", s(d.totals.claimed_sol)]].map(([k, v]) => <div key={k} className="card p-4"><div className="eyebrow">{k}</div><div className="mono mt-2 text-lg font-semibold">{v}</div></div>)}</div>
      <div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="mono border-b border-[var(--line)] text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="px-5 py-3 font-normal">Coin</th><th className="px-5 py-3 font-normal">Launched</th><th className="px-5 py-3 font-normal">Fees</th><th className="px-5 py-3 font-normal text-right">Claimable</th><th className="px-5 py-3 font-normal text-right">Claimed</th></tr></thead>
        <tbody>{d.launched.length ? d.launched.map((l: any) => { const f = d.fees.find((x: any) => x.mint === l.mint); return <tr key={l.mint} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-3)]"><td className="px-5 py-3"><Link href={`/token/${l.mint}`} className="flex items-center gap-3">{l.logo_cid && <img src={ipfsImg(l.logo_cid)} alt="" className="h-8 w-8 rounded-lg object-cover" />}<span className="font-semibold">${l.ticker}</span><span className="text-[var(--muted)]">{l.name}</span></Link></td><td className="px-5 py-3 mono text-[12px]">{ago(l.launched_at)} ago</td><td className="px-5 py-3 text-[12.5px] text-[var(--fg-2)]">{l.fee_label}</td><td className="px-5 py-3 text-right mono">{f ? s(f.claimable_sol) : "—"}</td><td className="px-5 py-3 text-right mono">{f ? s(f.claimed_sol) : "—"}</td></tr>; }) : <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--muted)]">This wallet hasn’t launched or received fees from any coin here.</td></tr>}</tbody></table></div>
      {d.totals.claimable_sol > 0 && <p className="mt-4 text-[13px] text-[var(--fg-2)]">Claimable fees? <Link href="/claim" className="text-[var(--accent)]">Claim them →</Link> (connect this wallet, or use your claim code).</p>}
    </div>}
  </div>);
}
