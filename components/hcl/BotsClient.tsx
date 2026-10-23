"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import ExternalPay from "./ExternalPay";
import { usePoll, sol, ago, short, ipfsImg } from "./ui";
import LiveChart from "./LiveChart";
const FILTERS = [["all", "All"], ["new", "New"], ["graduating", "About to graduate"], ["graduated", "Graduated"]] as const;
const ICON: Record<string, string> = { volume: "📈", bump: "⏫", buy: "🟢", sell: "🔻", holders: "👥" };
function BotsClientInner() {
  const [filter, setFilter] = useState("all");
  const [d, reload] = usePoll<any>(`/api/bots?filter=${filter}${typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mint") ? `&mint=${new URLSearchParams(window.location.search).get("mint")}` : ""}`, 8000, null);
  const [feed] = usePoll<any>(`/api/bots?what=feed`, 2500, { feed: [] });
  const [coin, setCoin] = useState<any>(null); const [kind, setKind] = useState("volume"); const [pkg, setPkg] = useState("");
  const [preview, setPreview] = useState(""); const [ext, setExt] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  useEffect(() => { setPreview(""); setErr(""); setOk(""); setExt(null); }, [coin, kind, pkg]);
  // preselect the ?mint= coin once markets load; deliberately not re-run when the user changes coin
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const m = new URLSearchParams(location.search).get("mint"); if (m && d?.markets && !coin) { const f = d.focus ?? d.markets.find((x: any) => x.mint === m); if (f) setCoin(f); } }, [d?.markets, d?.focus]);
  useEffect(() => { if (d?.kinds?.[kind]) setPkg(d.kinds[kind].pkgs[0].id); }, [kind, d?.kinds]);
  async function order(confirm: boolean) {
    setBusy(true); setErr("");
    try { const r = await fetch("/api/bots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint: coin.mint, kind, package: pkg, confirm }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); if (confirm) { setOk(j.text); setPreview(""); reload(); } else setPreview(j.text); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function payExternal() { setBusy(true); setErr(""); try { const r = await fetch("/api/bots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint: coin.mint, kind, package: pkg, pay: "external" }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setExt(j.payment); setPreview(""); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  const K = d?.kinds;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <section className="min-w-0">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{K && Object.entries(K).map(([k, v]: any) => <button key={k} onClick={() => setKind(k)} data-on={k === kind ? "1" : "0"} className={"card p-4 text-left transition-colors " + (k === kind ? "!border-[var(--accent)] shadow-[0_0_0_1px_rgba(60,240,224,.25)]" : "hover:border-[var(--line-2)]")}><div className="text-[22px]">{ICON[k]}</div><div className="mt-2 text-[14px] font-semibold">{v.title}</div></button>)}</div>
      {K && <p className="mt-3 text-[14px] text-[var(--fg-2)]">{K[kind].desc}</p>}
      {coin && <div className="card mt-6 p-5"><div className="mb-3 flex items-center gap-3"><img src={ipfsImg(coin.logo_cid)} alt="" className="h-9 w-9 rounded-lg object-cover" /><a href={`/token/${coin.mint}`} className="font-semibold hover:text-[var(--accent)]">{coin.name} <span className="mono text-[12px] text-[var(--accent)]">${coin.ticker}</span></a></div><LiveChart mint={coin.mint} height={300} /></div>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="display text-[20px] font-semibold">1 · Pick a coin</h2><div className="seg">{FILTERS.map(([v, l]) => <button key={v} data-on={v === filter ? "1" : "0"} onClick={() => setFilter(v)}>{l}</button>)}</div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{!d ? <div className="card p-6 text-[var(--muted)]">Loading coins…</div> : !d.markets.length ? <div className="card p-6 text-[var(--muted)]">No coins in this filter.</div> : d.markets.map((m: any) => <button key={m.mint} onClick={() => setCoin(m)} className={"card spot flex items-center gap-3 p-3 text-left " + (coin?.mint === m.mint ? "!border-[var(--accent)]" : "")}>
        <img src={ipfsImg(m.logo_cid)} alt="" className="h-12 w-12 rounded-xl bg-[var(--bg-3)] object-cover" /><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{m.name}</span><span className="mono text-[12px] text-[var(--accent)]">${m.ticker}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-3)]"><div className="h-full bg-[var(--grad)]" style={{ width: `${Math.max(2, m.progress)}%`, background: "var(--grad)" }} /></div><div className="mono mt-1 text-[11px] text-[var(--muted)]">{m.progress.toFixed(1)}% curve · {m.status}</div></div></button>)}</div>
    </section>
    <aside className="space-y-4 lg:sticky lg:top-[calc(var(--nav-h)+16px)] lg:self-start">
      <div className="card p-5"><h2 className="display text-[18px] font-semibold">2 · Package</h2>
        {K && <div className="mt-3 space-y-2">{K[kind].pkgs.map((p: any) => <label key={p.id} className={"flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors " + (p.id === pkg ? "border-[var(--accent)] bg-[rgba(60,240,224,.06)]" : "border-[var(--line)] hover:border-[var(--line-2)]")}><input type="radio" className="sr-only" checked={p.id === pkg} onChange={() => setPkg(p.id)} /><div><div className="font-semibold">{p.name}</div><div className="text-[12.5px] text-[var(--muted)]">{p.blurb}</div></div><div className="mono text-[14px] text-[var(--accent)]">{p.price} SOL</div></label>)}</div>}
        <div className="mt-4 rounded-xl bg-[var(--bg)] p-3 text-[13px]">{coin ? <>Coin: <b>{coin.name}</b> <span className="mono text-[var(--muted)]">{short(coin.mint)}</span></> : <span className="text-[var(--muted)]">Pick a coin on the left.</span>}</div>
        {!d?.signedIn ? <a href="/settings" className="btn-primary btn-big mt-4 w-full">Sign in to order</a> : preview ? <><pre className="mono mt-4 whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-[12px] text-[var(--fg-2)]">{preview}</pre><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => order(true)} className="btn-accent btn-big flex-1">{busy ? "Paying…" : "Confirm & pay"}</button><button onClick={() => setPreview("")} className="btn-ghost btn-big">Back</button></div></> : <button disabled={!coin || busy} onClick={() => order(false)} className="btn-accent btn-big mt-4 w-full">{busy ? "…" : "Preview order"}</button>}
        {coin && !ext && <button disabled={busy} onClick={payExternal} className="btn-ghost mt-3 w-full !h-10">Pay from any wallet (Phantom, Solflare…)</button>}
        {ext && <ExternalPay p={ext} onDone={t => { setOk(t); setExt(null); reload(); }} />}
        {err && <p className="down mt-3 whitespace-pre-wrap text-[13px]">{err}</p>}{ok && <p className="up mt-3 whitespace-pre-wrap text-[13px]">{ok}</p>}
        <p className="mt-3 text-[11.5px] text-[var(--muted)]">Devnet SOL only. Paid from your HeyClawLaunch wallet or any wallet. Track bots on your <a href="/dashboard" className="underline">dashboard</a>. Max ~1 SOL volume per order. Real transactions on the pump.fun bonding curve.</p>
      </div>
      {!!d?.orders?.length && <div className="card p-5"><div className="eyebrow">Your orders</div><ul className="mt-3 space-y-2 text-[13px]">{d.orders.map((o: any) => <li key={o.id} className="flex items-center justify-between gap-2"><span>{ICON[o.kind]} ${o.ticker} · {o.package}</span><span className="mono text-[var(--muted)]">{o.trades}/{o.max_trades} · <span className={o.status === "done" ? "up" : o.status === "stopped" ? "down" : ""}>{o.status}</span></span></li>)}</ul></div>}
      <div className="card p-5"><div className="eyebrow"><span className="live-dot"></span>Live bot transactions</div>
        <ul className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto text-[12.5px]"><AnimatePresence initial={false}>{!feed.feed.length ? <li className="text-[var(--muted)]">No bot transactions yet.</li> : feed.feed.map((t: any) => <motion.li layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} key={t.id} className="flex items-center justify-between gap-2"><span className={t.side === "buy" ? "up" : t.side === "sell" ? "down" : t.side === "error" ? "down" : "text-[var(--fg-2)]"}>{t.side}</span><span className="mono">{t.ticker ? `$${t.ticker}` : ""}</span><span className="mono">{t.lamports ? sol(t.lamports / 1e9) : ""}</span>{t.url ? <a className="mono text-[var(--muted)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer" href={t.url}>{ago(t.ts)} ↗</a> : <span className="mono text-[var(--muted)]" title={t.error ?? ""}>{ago(t.ts)}</span>}</motion.li>)}</AnimatePresence></ul></div>
    </aside>
  </div>;
}

// MotionConfig lives here (not in the root layout) so framer-motion only ships on pages that animate with it.
export default function BotsClient() { return <MotionConfig reducedMotion="user"><BotsClientInner  /></MotionConfig>; }
