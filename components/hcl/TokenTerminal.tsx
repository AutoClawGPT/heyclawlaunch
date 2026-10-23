"use client";
// pump.fun / DexScreener-style coin page (spec: FIXPLAN.md "Oct 23 UI").
// Every number is the exact devnet on-chain curve/pool value × live SOL/USD.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createChart, CandlestickSeries, HistogramSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import SafeImg from "@/components/hg/SafeImg";
import { ago, sol } from "./ui";
import { priceSub, usdCompact, numCompact, pct, shortAddr, agoS } from "@/lib/fmt";
export type TokenProps = { mint: string; snapAt?: number; name: string; ticker: string; logo: string | null; pair: string; supply: number; priceQuote: number | null; usdPerQuote: number | null;
  complete: boolean; progress: number; liqQuote: number; holders: number | null; pool?: string | null; creator?: string | null; launchedAt?: string | null;
  description?: string | null; x?: string | null; website?: string | null; telegram?: string | null; shares?: { address: string; bps: number }[]; feeTo: string; curve?: string | null; createSig?: string | null };
const IVS = ["1m", "5m", "15m", "1h", "4h", "1d"];
const SRC: Record<string, string> = { "4h": "1h", "1d": "1h" }; const SEC: Record<string, number> = { "4h": 14400, "1d": 86400 };
/** 4h / 1d candles: exact OHLC aggregation of the real 1h candles (no API change). */
function agg(d: any, iv: string) { const n = SEC[iv]; if (!d?.candles || !n) return d; const out: any[] = [];
  for (const k of d.candles) { const t = Math.floor(k.time / n) * n; const o = out.at(-1);
    if (o && o.time === t) { o.high = Math.max(o.high, k.high); o.low = Math.min(o.low, k.low); o.close = k.close; o.volume += k.volume; } else out.push({ ...k, time: t }); }
  return { ...d, candles: out }; }
const txUrl = (s: string) => `https://solscan.io/tx/${s}?cluster=devnet`, acct = (a: string) => `https://solscan.io/account/${a}?cluster=devnet`;
const L = "text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]";
function usePoll(url: string, ms: number) { const [d, setD] = useState<any>(null); useEffect(() => { let on = true; const go = () => fetch(url, { cache: "no-store" }).then(r => r.json()).then(j => on && setD(j)).catch(() => {}); go(); const id = setInterval(go, ms); return () => { on = false; clearInterval(id); }; }, [url, ms]); return d; }
function Copy({ v }: { v: string }) { const [ok, setOk] = useState(false); return <button aria-label="copy" onClick={() => { navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1200); }} className="mono rounded-md bg-[var(--bg-3)] px-2 py-0.5 text-[11.5px] text-[var(--fg-2)] hover:text-[var(--fg)]">{ok ? "copied" : shortAddr(v) + " ⧉"}</button>; }

export default function TokenTerminal(p: TokenProps) {
  const router = useRouter();
  useEffect(() => { const id = setInterval(() => router.refresh(), 4000); return () => clearInterval(id); }, [router]); // re-read curve/pool on chain
  const [iv, setIv] = useState("1m"); const [ccy, setCcy] = useState<"usd" | "quote">("usd"); const [mode, setMode] = useState<"mcap" | "price">("mcap");
  const raw = usePoll(`/api/candles/${p.mint}?interval=${SRC[iv] ?? iv}`, 3000); const d = agg(raw, iv); const ts = usePoll(`/api/tokenstats/${p.mint}`, 4000);
  // Live price: the server snapshot (curve/pool reserves) until a newer indexed trade arrives via the 3s feed, then that trade's exact devnet price.
  const lt = raw?.trades?.[0]; const pq: number | null = lt?.price && +new Date(lt.ts) > (p.snapAt ?? 0) - 2000 ? lt.price : p.priceQuote;
  const usd: number | null = d?.usd_per_quote ?? p.usdPerQuote; const q = p.pair;
  const priceUsd = pq != null && usd ? pq * usd : null; const mcapUsd = priceUsd != null ? priceUsd * p.supply : null;
  const athUsd = ts?.ath && usd ? Math.max(ts.ath * usd * p.supply, mcapUsd ?? 0) : mcapUsd;
  const w24 = ts?.windows?.["24h"]; const chg24 = w24?.open && pq ? ((pq - w24.open) / w24.open) * 100 : ts ? 0 : null;
  const v24 = (w24?.buy_vol ?? 0) + (w24?.sell_vol ?? 0); const liqUsd = usd ? p.liqQuote * usd : null;
  const [tab, setTab] = useState<"trades" | "holders" | "comments">("comments");
  const socials = [p.x && ["X", p.x.startsWith("http") ? p.x : `https://x.com/${p.x.replace(/^@/, "")}`], p.website && ["Web", p.website], p.telegram && ["TG", p.telegram.startsWith("http") ? p.telegram : `https://t.me/${p.telegram.replace(/^@/, "")}`]].filter(Boolean) as [string, string][];
  return <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_350px]">
    <div className="flex min-w-0 flex-col gap-3">
      {/* A. header */}
      <section className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4" data-sec="header">
        <div className="flex min-w-0 flex-1 items-center gap-3"><SafeImg src={p.logo} size={60} rounded={12} label={p.ticker} />
          <div className="min-w-0"><div className="flex min-w-0 items-baseline gap-2"><h1 className="shrink-0 text-[22px] font-bold leading-tight">{p.ticker}</h1>{p.complete && <span className="rounded-md bg-[#3ce39b]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#3ce39b]">Graduated</span>}<span className="truncate text-[15px] text-[var(--fg-2)]">{p.name}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">{p.launchedAt && <span className="mono">{agoS(p.launchedAt)}</span>}<Copy v={p.mint} />{p.creator && <a href={acct(p.creator)} target="_blank" rel="noreferrer" className="mono hover:text-[var(--accent)]">by {shortAddr(p.creator)}</a>}{socials.map(([k, u]) => <a key={k} href={u} target="_blank" rel="noreferrer" className="rounded-md bg-[var(--bg-3)] px-2 py-0.5 text-[11.5px] hover:text-[var(--fg)]">{k}</a>)}<a href={acct(p.mint)} target="_blank" rel="noreferrer" className="rounded-md bg-[var(--bg-3)] px-2 py-0.5 text-[11.5px] hover:text-[var(--fg)]">Solscan ↗</a></div></div></div>
        <div className="grid grid-cols-4 gap-4 sm:gap-6">
          <div><div className={L}>Market cap</div><div className="mono text-[17px] font-bold tabular-nums" data-testid="mcap">{usdCompact(mcapUsd)}</div></div>
          <div><div className={L}>24h vol</div><div className="mono text-[17px] font-bold tabular-nums">{usd ? usdCompact(v24 * usd) : "—"}</div></div>
          <div><div className={L}>Holders</div><div className="mono text-[17px] font-bold tabular-nums">{p.holders ?? "—"}</div></div>
          <div><div className={L}>ATH</div><div className="mono text-[17px] font-bold tabular-nums">{usdCompact(athUsd)}</div></div>
        </div>
      </section>
      {/* B. chart */}
      <Chart d={d} iv={iv} setIv={setIv} ccy={ccy} setCcy={setCcy} mode={mode} setMode={setMode} supply={p.supply} q={q} ticker={p.ticker} priceUsd={priceUsd} chg={chg24} />
      {/* mobile: trade + stats right under the chart */}
      <div className="flex flex-col gap-3 lg:hidden"><TradePanel {...p} usd={usd} /><Stats ts={ts} usd={usd} price={pq} /><Curve {...p} liqUsd={liqUsd} mcapUsd={mcapUsd} /></div>
      <LiveTrades d={raw} />
      <Calls list={ts?.calls} usd={usd} supply={p.supply} price={pq} />
      {/* G. tabs */}
      <section className="card overflow-hidden" data-sec="tabs">
        <div className="flex items-center gap-1 border-b border-[var(--line)] px-2 pt-2">{(["comments", "trades", "holders"] as const).map(t => <button key={t} onClick={() => setTab(t)} className={"px-3 pb-2 text-[13.5px] font-semibold capitalize " + (tab === t ? "border-b-2 border-[var(--accent)] text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]")}>{t === "comments" ? "Thread" : t === "holders" ? "Top holders" : "Trades"}{t === "holders" && p.holders != null ? <span className="ml-1.5 text-[11px] text-[var(--muted)]">{p.holders}</span> : t === "comments" && ts?.comments?.length ? <span className="ml-1.5 text-[11px] text-[var(--muted)]">{ts.comments.length}</span> : null}</button>)}</div>
        {tab === "trades" ? <Trades d={d} usd={usd} q={q} ticker={p.ticker} /> : tab === "holders" ? <Holders mint={p.mint} creator={p.creator} priceUsd={priceUsd} /> : <Comments list={ts?.comments} ticker={p.ticker} />}
      </section>
    </div>
    <aside className="hidden flex-col gap-3 lg:flex"><TradePanel {...p} usd={usd} /><Stats ts={ts} usd={usd} price={pq} /><Curve {...p} liqUsd={liqUsd} mcapUsd={mcapUsd} /><Info {...p} /></aside>
    <div className="lg:hidden"><Info {...p} /></div>
  </div>;
}

function Chart({ d, iv, setIv, ccy, setCcy, mode, setMode, supply, q, ticker, priceUsd, chg }: any) {
  const el = useRef<HTMLDivElement>(null); const chart = useRef<IChartApi | null>(null); const cs = useRef<ISeriesApi<"Candlestick"> | null>(null); const vs = useRef<ISeriesApi<"Histogram"> | null>(null); const fit = useRef("");
  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, { layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a90a8", fontSize: 11 }, grid: { vertLines: { color: "rgba(160,170,220,.05)" }, horzLines: { color: "rgba(160,170,220,.05)" } }, rightPriceScale: { borderColor: "rgba(160,170,220,.12)" }, timeScale: { borderColor: "rgba(160,170,220,.12)", timeVisible: true, secondsVisible: false }, autoSize: true });
    cs.current = c.addSeries(CandlestickSeries, { upColor: "#3ce39b", downColor: "#ff5a6e", wickUpColor: "#3ce39b", wickDownColor: "#ff5a6e", borderVisible: false, priceFormat: { type: "custom", formatter: (v: number) => v >= 1 ? numCompact(v, 2) : priceSub(v, ""), minMove: 1e-15 } });
    vs.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c; return () => { c.remove(); chart.current = null; };
  }, []);
  useEffect(() => {
    if (!d?.candles) return; const m = (ccy === "usd" && d.usd_per_quote ? d.usd_per_quote : 1) * (mode === "mcap" ? supply : 1); const vm = ccy === "usd" && d.usd_per_quote ? d.usd_per_quote : 1;
    cs.current?.setData(d.candles.map((k: any) => ({ time: k.time as UTCTimestamp, open: k.open * m, high: k.high * m, low: k.low * m, close: k.close * m })));
    vs.current?.setData(d.candles.map((k: any) => ({ time: k.time as UTCTimestamp, value: k.volume * vm, color: k.close >= k.open ? "rgba(60,227,155,.4)" : "rgba(255,90,110,.4)" })));
    const key = `${iv}${ccy}${mode}`; if (fit.current !== key && d.candles.length) { chart.current?.timeScale().fitContent(); fit.current = key; }
  }, [d, ccy, mode, supply, iv]);
  const last = d?.candles?.at(-1); const m = (ccy === "usd" && d?.usd_per_quote ? d.usd_per_quote : 1) * (mode === "mcap" ? supply : 1);
  const fmt = (v: number) => ccy === "usd" ? (mode === "mcap" ? usdCompact(v) : priceSub(v)) : (mode === "mcap" ? numCompact(v, 2) + " " + q : priceSub(v, "") + " " + q);
  return <section className="card p-3 sm:p-4" data-sec="chart">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><div className="mono text-[12px] text-[var(--muted)]">{ticker}/{q} · {mode === "mcap" ? "Market cap" : "Price"} ({ccy === "usd" ? "USD" : q})</div>
        <div className="mono flex items-baseline gap-2"><span className="text-[22px] font-bold tabular-nums" data-testid="price">{priceSub(priceUsd)}</span><span className={"text-[13px] font-semibold " + ((chg ?? 0) >= 0 ? "up" : "down")}>{pct(chg)} <span className="font-normal text-[var(--muted)]">24h</span></span></div>
        {last && <div className="mono text-[11px] text-[var(--muted)]">O {fmt(last.open * m)} H {fmt(last.high * m)} L {fmt(last.low * m)} C {fmt(last.close * m)}</div>}</div>
      <div className="flex flex-wrap items-center gap-1.5"><div className="seg">{IVS.map(x => <button key={x} data-on={x === iv ? "1" : "0"} onClick={() => setIv(x)}>{x}</button>)}</div>
        <div className="seg">{(["price", "mcap"] as const).map(x => <button key={x} data-on={x === mode ? "1" : "0"} onClick={() => setMode(x)}>{x === "mcap" ? "MCap" : "Price"}</button>)}</div>
        <div className="seg">{(["usd", "quote"] as const).map(x => <button key={x} data-on={x === ccy ? "1" : "0"} onClick={() => setCcy(x)}>{x === "usd" ? "USD" : q}</button>)}</div></div>
    </div>
    <div className="relative mt-3 h-[300px] sm:h-[420px]"><div ref={el} className="absolute inset-0" />{d?.initial && <div className="pointer-events-none absolute left-2 top-1 text-[11.5px] text-[var(--muted)]">No trades yet</div>}</div>
  </section>;
}

function TradePanel(p: TokenProps & { usd: number | null }) {
  const [side, setSide] = useState<"buy" | "sell">("buy"); const [amt, setAmt] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: string; ok?: boolean; preview?: boolean } | null>(null);
  const [k, setK] = useState(0); const bal = usePoll(`/api/wallet-balance/${p.mint}?k=${k}`, 15000);
  const args = (confirm: boolean) => side === "buy" ? { from: p.pair, to: p.mint, amount: amt, confirm } : { from: p.mint, to: p.pair, amount: amt, confirm };
  async function run(confirm: boolean) { if (!amt) return; setBusy(true); setMsg(null);
    try { const r = await fetch("/api/v1/tools/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args(confirm)) }); const j = await r.json().catch(() => ({}));
      if (r.status === 401) setMsg({ t: "Connect your wallet to trade." }); else setMsg({ t: j.text ?? j.error ?? "Something went wrong.", ok: r.ok && !j.isError, preview: !confirm && r.ok && !j.isError }); if (confirm) setK(x => x + 1); }
    catch { setMsg({ t: "Network error, try again." }); } finally { setBusy(false); } }
  const connected = bal?.connected; const have = side === "buy" ? bal?.sol : bal?.tokens;
  const chips = side === "buy" ? [["0.01", "0.01"], ["0.05", "0.05"], ["0.1", "0.1"], ["0.5", "0.5"]] : [["25%", "0.25"], ["50%", "0.5"], ["75%", "0.75"], ["100%", "all"]];
  const pick = (v: string) => { setMsg(null); if (side === "sell" && v !== "all") setAmt(have ? String(Math.floor(have * Number(v))) : ""); else setAmt(v); };
  const quoteUsd = side === "buy" && p.usd && Number(amt) ? Number(amt) * p.usd : null;
  return <section className="card p-4" data-sec="trade">
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-3)] p-1">{(["buy", "sell"] as const).map(s => <button key={s} onClick={() => { setSide(s); setAmt(""); setMsg(null); }} className={"h-9 rounded-lg text-[14px] font-bold capitalize " + (side === s ? (s === "buy" ? "bg-[#3ce39b] text-black" : "bg-[#ff5a6e] text-white") : "text-[var(--muted)]")}>{s}</button>)}</div>
    <div className="mono mt-3 flex justify-between text-[11.5px] text-[var(--muted)]"><span>{connected ? "Balance" : "Not connected"}</span>{connected && <span data-testid="balance">{side === "buy" ? `${numCompact(bal?.sol ?? 0, 4)} ${p.pair}` : `${numCompact(bal?.tokens ?? 0, 2)} ${p.ticker}`}</span>}</div>
    <label className="mt-1.5 flex items-center rounded-xl border border-[var(--line)] px-3 focus-within:border-[var(--accent)]"><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^0-9.]/g, "")); setMsg(null); }} placeholder="0.00" className="mono h-12 min-w-0 flex-1 bg-transparent text-[18px] outline-none" /><span className="mono text-[13px] font-semibold text-[var(--fg-2)]">{side === "buy" ? p.pair : p.ticker}</span></label>
    <div className="mt-2 grid grid-cols-4 gap-1.5">{chips.map(([t, v]) => <button key={t} onClick={() => pick(v)} className="mono rounded-lg bg-[var(--bg-3)] py-1.5 text-[12px] text-[var(--fg-2)] hover:text-[var(--fg)]">{t}{side === "buy" ? "" : ""}</button>)}</div>
    {quoteUsd != null && <div className="mono mt-2 text-[11.5px] text-[var(--muted)]">≈ {usdCompact(quoteUsd)}</div>}
    {!connected && bal ? <a href="/claim" className="btn-primary btn-big mt-3 w-full">Connect wallet to trade</a>
      : msg?.preview ? <button disabled={busy} onClick={() => run(true)} className={"btn-big mt-3 w-full rounded-xl font-bold " + (side === "buy" ? "bg-[#3ce39b] text-black" : "bg-[#ff5a6e] text-white")}>{busy ? "Sending…" : `Confirm ${side}`}</button>
      : <button disabled={busy || !amt} onClick={() => run(false)} className={"btn-big mt-3 w-full rounded-xl font-bold disabled:opacity-50 " + (side === "buy" ? "bg-[#3ce39b] text-black" : "bg-[#ff5a6e] text-white")}>{busy ? "Quoting…" : side === "buy" ? `Buy ${p.ticker}` : `Sell ${p.ticker}`}</button>}
    {msg && <p className={"mt-2 whitespace-pre-wrap break-words text-[12px] " + (msg.ok ? "text-[var(--fg-2)]" : "text-[#ff5a6e]")}>{msg.t}</p>}
  </section>;
}

function Stats({ ts, usd, price }: { ts: any; usd: number | null; price: number | null }) {
  const [w, setW] = useState("24h"); const s = ts?.windows?.[w]; const chg = s?.open && price ? ((price - s.open) / s.open) * 100 : s ? 0 : null;
  const bar = (a: number, b: number) => <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full"><div className="bg-[#3ce39b]" style={{ flex: a || (a + b ? 0 : 1) }} /><div className="bg-[#ff5a6e]" style={{ flex: b || (a + b ? 0 : 1) }} /></div>;
  const u = (v: number) => usd ? usdCompact(v * usd) : "—";
  return <section className="card p-4" data-sec="stats">
    <div className="flex items-center justify-between"><span className="text-[13.5px] font-semibold">Stats</span><div className="seg">{["5m", "1h", "6h", "24h"].map(x => <button key={x} data-on={x === w ? "1" : "0"} onClick={() => setW(x)}>{x}</button>)}</div></div>
    <div className="mono mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px] tabular-nums">
      <div><div className={L}>Price change</div><div className={"font-semibold " + ((chg ?? 0) >= 0 ? "up" : "down")}>{pct(chg)}</div></div>
      <div className="text-right"><div className={L}>Volume</div><div className="font-semibold">{s ? u(s.buy_vol + s.sell_vol) : "—"}</div></div>
      <div className="col-span-2"><div className="flex justify-between"><span><b className="up">{s?.buys ?? 0}</b> buys</span><span><b className="down">{s?.sells ?? 0}</b> sells</span></div>{bar(s?.buys ?? 0, s?.sells ?? 0)}</div>
      <div className="col-span-2"><div className="flex justify-between"><span><b className="up">{s ? u(s.buy_vol) : "—"}</b> buy vol</span><span><b className="down">{s ? u(s.sell_vol) : "—"}</b> sell vol</span></div>{bar(s?.buy_vol ?? 0, s?.sell_vol ?? 0)}</div>
      <div className="col-span-2"><div className="flex justify-between"><span><b className="up">{s?.buyers ?? 0}</b> buyers</span><span><b className="down">{s?.sellers ?? 0}</b> sellers</span></div>{bar(s?.buyers ?? 0, s?.sellers ?? 0)}</div>
    </div>
  </section>;
}

function Curve(p: TokenProps & { liqUsd: number | null; mcapUsd: number | null }) {
  return <section className="card p-4" data-sec="curve">
    <div className="flex items-center justify-between text-[13.5px]"><span className="font-semibold">{p.complete ? "Graduated to PumpSwap" : "Bonding curve progress"}</span><span className="mono font-semibold tabular-nums text-[#3ce39b]">{p.progress.toFixed(1)}%</span></div>
    <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[#3ce39b]" style={{ width: `${Math.max(1.5, p.progress)}%` }} /></div>
    <div className="mono mt-3 grid grid-cols-2 gap-y-1.5 text-[12px]"><span className="text-[var(--muted)]">{p.complete ? "Pool liquidity" : `${numCompact(p.liqQuote, 3)} ${p.pair} in bonding curve`}</span><span className="text-right">{usdCompact(p.liqUsd)} <span className="text-[var(--muted)]">({numCompact(p.liqQuote, 3)} {p.pair})</span></span>
      <span className="text-[var(--muted)]">Paired with</span><span className="text-right">{p.pair}</span>
      {p.complete && p.pool && <><span className="text-[var(--muted)]">Pool</span><a className="text-right text-[var(--accent)]" href={acct(p.pool)} target="_blank" rel="noreferrer">{shortAddr(p.pool)}</a></>}</div>
    {!p.complete && <p className="mt-2.5 text-[12px] text-[var(--muted)]">Graduates to PumpSwap when the curve reaches 100%.</p>}
  </section>;
}

function Info(p: TokenProps) {
  return <section className="card p-4" data-sec="info">
    {p.description && <><div className="text-[13.5px] font-semibold">About</div><p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] text-[var(--fg-2)]">{p.description}</p></>}
    <div className={"text-[13.5px] font-semibold " + (p.description ? "mt-4" : "")}>Creator rewards</div>
    <div className="mono mt-1.5 text-[12px] text-[var(--fg-2)]">{p.feeTo}</div>
    {(p.shares ?? []).map(s => <div key={s.address} className="mono mt-1.5 flex items-center justify-between text-[12px]"><a className="hover:text-[var(--accent)]" href={acct(s.address)} target="_blank" rel="noreferrer">{shortAddr(s.address)}</a><span>{s.bps / 100}%</span></div>)}
    <div className="mt-4 text-[13.5px] font-semibold">Contract</div>
    <div className="mono mt-1.5 space-y-1.5 text-[12px]"><div className="flex justify-between"><span className="text-[var(--muted)]">Mint</span><a href={acct(p.mint)} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">{shortAddr(p.mint)}</a></div>
      {p.curve && <div className="flex justify-between"><span className="text-[var(--muted)]">Bonding curve</span><a href={acct(p.curve)} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">{shortAddr(p.curve)}</a></div>}
      {p.createSig && <div className="flex justify-between"><span className="text-[var(--muted)]">Launch tx</span><a href={txUrl(p.createSig)} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">{shortAddr(p.createSig)}</a></div>}
      <div className="flex justify-between"><span className="text-[var(--muted)]">Supply</span><span>{numCompact(p.supply, 0)}</span></div></div>
  </section>;
}

function Trades({ d, usd, q, ticker }: { d: any; usd: number | null; q: string; ticker: string }) {
  return <div className="max-h-[480px] overflow-auto"><table className="mono w-full min-w-[600px] text-[12.5px] tabular-nums"><thead className="sticky top-0 z-10 bg-[var(--bg)]"><tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]"><th className="px-3 py-2 font-normal">Time</th><th className="px-2 py-2 font-normal">Type</th><th className="px-2 py-2 text-right font-normal">USD</th><th className="px-2 py-2 text-right font-normal">{ticker}</th><th className="px-2 py-2 text-right font-normal">{q}</th><th className="px-2 py-2 text-right font-normal">Maker</th><th className="px-3 py-2 text-right font-normal">Txn</th></tr></thead>
    <tbody>{!d?.trades?.length ? <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--muted)]">{d ? "No trades yet." : "Loading…"}</td></tr> : d.trades.map((t: any) => { const b = t.side === "buy"; return <tr key={t.sig} className="border-t border-[var(--line)] hover:bg-[var(--bg-3)]"><td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">{agoS(t.ts)} ago</td><td className={"px-2 py-2 font-semibold " + (b ? "up" : "down")}>{b ? "Buy" : "Sell"}</td><td className={"px-2 py-2 text-right " + (b ? "up" : "down")}>{usd ? usdCompact(t.sol * usd) : "—"}</td><td className="px-2 py-2 text-right">{t.tokens ? numCompact(t.tokens) : "—"}</td><td className="px-2 py-2 text-right">{numCompact(t.sol, 4)}</td><td className="px-2 py-2 text-right"><a className="hover:text-[var(--accent)]" href={acct(t.trader)} target="_blank" rel="noreferrer">{shortAddr(t.trader)}</a></td><td className="px-3 py-2 text-right"><a className="text-[var(--muted)] hover:text-[var(--accent)]" href={txUrl(t.sig)} target="_blank" rel="noreferrer">↗</a></td></tr>; })}</tbody></table></div>;
}

function Holders({ mint, creator, priceUsd }: { mint: string; creator?: string | null; priceUsd: number | null }) {
  const j = usePoll(`/api/holders/${mint}`, 20000); const hs: any[] | null = j ? j.holders ?? [] : null;
  return <div className="max-h-[480px] overflow-auto">{hs == null ? <div className="px-3 py-10 text-center text-[var(--muted)]">Loading…</div> : !hs.length ? <div className="px-3 py-10 text-center text-[var(--muted)]">No holders yet.</div>
    : <table className="mono w-full text-[12.5px] tabular-nums"><thead><tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]"><th className="px-3 py-2 font-normal">#</th><th className="px-2 py-2 font-normal">Holder</th><th className="px-2 py-2 text-right font-normal">% supply</th><th className="hidden px-2 py-2 text-right font-normal sm:table-cell">Amount</th><th className="px-3 py-2 text-right font-normal">Value</th></tr></thead>
      <tbody>{hs.map((h, i) => <tr key={h.owner + i} className="border-t border-[var(--line)]"><td className="px-3 py-2 text-[var(--muted)]">{i + 1}</td><td className="px-2 py-2"><a href={acct(h.owner)} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">{shortAddr(h.owner)}</a>{h.label && <span className="ml-1.5 rounded bg-[var(--bg-3)] px-1.5 text-[10.5px] text-[var(--muted)]">{h.label}</span>}{h.owner === creator && <span className="ml-1.5 rounded bg-[var(--bg-3)] px-1.5 text-[10.5px] text-[var(--muted)]">dev</span>}</td><td className="px-2 py-2 text-right"><span className="inline-flex items-center gap-2"><span className="hidden h-1 w-14 overflow-hidden rounded-full bg-[var(--line)] sm:inline-block"><span className="block h-full bg-[#3ce39b]" style={{ width: `${Math.min(100, h.pct)}%` }} /></span>{h.pct.toFixed(2)}%</span></td><td className="hidden px-2 py-2 text-right sm:table-cell">{numCompact(h.amount)}</td><td className="px-3 py-2 text-right">{priceUsd != null ? usdCompact(h.amount * priceUsd) : "—"}</td></tr>)}</tbody></table>}</div>;
}

function Comments({ list, ticker }: { list?: any[]; ticker: string }) {
  return <div className="max-h-[480px] overflow-auto p-3"><Link href="/community" className="btn-ghost !h-9 w-full">Post about ${ticker} in Community</Link>
    {list == null ? <div className="py-8 text-center text-[var(--muted)]">Loading…</div> : !list.length ? <div className="py-8 text-center text-[13px] text-[var(--muted)]">No comments yet. Mention ${ticker} in a Community post and it shows here.</div>
      : list.map(c => <div key={c.id} className="flex gap-2.5 border-t border-[var(--line)] py-3 first:border-0"><SafeImg src={c.avatar} size={32} rounded={16} label={c.author} /><div className="min-w-0"><div className="text-[12.5px]"><b>{c.author}</b> <span className="mono text-[var(--muted)]">{agoS(c.created_at)}</span></div><p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-[var(--fg-2)]">{c.body}</p></div></div>)}</div>;
}

function Calls({ list, usd, supply, price }: { list?: any[]; usd: number | null; supply: number; price: number | null }) {
  if (!list?.length) return null;
  return <section className="card p-4" data-sec="calls">
    <div className="flex items-center justify-between"><span className="text-[13.5px] font-semibold">Agent calls <span className="ml-1 text-[11px] text-[var(--muted)]">{list.length}</span></span><span className="text-[11px] text-[var(--muted)]">mcap at call → now</span></div>
    <div className="mt-2 flex flex-col">{list.map(c => { const at = c.price_at != null && usd ? c.price_at * supply * usd : null; const now = price != null && usd ? price * supply * usd : null; const x = at && now ? now / at : null; const up = (x ?? 1) >= 1;
      const who = <span className="flex min-w-0 items-center gap-2"><SafeImg src={c.avatar} size={32} rounded={16} label={c.author} /><span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{c.author}</span><span className="mono block truncate text-[11px] text-[var(--muted)]">{c.handle} · {agoS(c.created_at)} ago</span></span></span>;
      return <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--line)] py-2.5 first:border-0" data-testid="agent-call">
        {c.url ? <Link href={c.url} className="min-w-0 flex-1 hover:text-[var(--accent)]">{who}</Link> : <div className="min-w-0 flex-1">{who}</div>}
        <span className="mono text-right text-[12px] tabular-nums"><span className="text-[var(--muted)]">{usdCompact(at)} → </span>{usdCompact(now)} {x != null && <b className={"ml-1 rounded-md px-1.5 py-0.5 " + (up ? "bg-[#3ce39b]/15 text-[#3ce39b]" : "bg-[#ff5a6e]/15 text-[#ff5a6e]")}>{x >= 10 ? x.toFixed(0) : x.toFixed(2)}x</b>}</span>
        <p className="w-full whitespace-pre-wrap break-words text-[13px] text-[var(--fg-2)]">{c.side && c.side !== "call" && <b className={c.side === "buy" ? "up" : "down"}>{c.side.toUpperCase()} </b>}{c.body}</p></div>; })}</div>
  </section>;
}

/** Original "Live trades" feed from LiveChart (same /api/candles 3s poll, same markup): new devnet trades appear without a reload. */
function LiveTrades({ d }: { d: any }) {
  return <section className="card p-4" data-sec="live-trades" data-testid="live-trades"><div className="eyebrow"><span className="live-dot"></span>Live trades</div><div className="mt-2 max-h-[280px] overflow-y-auto"><table className="w-full text-[12.5px]"><tbody>{!d?.trades?.length ? <tr><td className="py-3 text-[var(--muted)]">No trades yet.</td></tr> : d.trades.map((t: any) => <tr key={t.sig} className="row"><td className={"py-2 pr-3 " + (t.side === "buy" ? "up" : "down")}>{t.side}</td><td className="py-2 pr-3 mono">{sol(t.sol, 4)}</td><td className="py-2 pr-3 mono text-[var(--fg-2)]">{t.tokens ? Math.round(t.tokens).toLocaleString() : ""}</td><td className="py-2 pr-3 mono text-[var(--muted)]">{t.trader.slice(0, 4)}…{t.trader.slice(-4)}</td><td className="py-2 text-right"><a className="mono text-[var(--muted)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}>{ago(t.ts)} ↗</a></td></tr>)}</tbody></table></div></section>;
}
