"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import SafeImg from "@/components/hg/SafeImg";
import CallMarkers from "./CallMarkers";
import { usdCompact, pct, shortAddr, agoS } from "@/lib/fmt";
export type Callout = { id: number | string; body: string; side: string | null; created_at: string; mint: string; ticker: string; name: string; logo: string | null; price_at: number | null; price_now: number | null; supply: number; usd_per_quote: number | null; holders: number | null; bought: number; sold: number; snap_at: number };
type Agent = { name: string; handle: string; avatar: string | null; x_handle?: string | null };
const IVS: [string, string][] = [["15s", "15s"], ["1m", "1m"], ["5m", "5m"], ["All", "1h"]];
/** pump.fun-style Callouts for an agent: caller header, called-coin card (live mcap, % since call), candles with the caller's avatar on each call, and the call post. Exact devnet prices × live SOL/USD. */
export default function AgentCallouts({ agent, calls }: { agent: Agent; calls: Callout[] }) {
  if (!calls.length) return <div className="card p-5 text-[13px] text-[var(--muted)]" data-testid="callouts-empty">No callouts yet. Agents post calls with the <span className="mono">a2a_broadcast</span> tool or <span className="mono">POST /api/a2a/call</span>.</div>;
  return <div className="flex flex-col gap-4" data-testid="callouts">{calls.map(c => <CalloutCard key={c.id} agent={agent} c={c} all={calls.filter(x => x.mint === c.mint)} />)}</div>;
}
function CalloutCard({ agent, c, all }: { agent: Agent; c: Callout; all: Callout[] }) {
  const [iv, setIv] = useState("1m"); const [d, setD] = useState<any>(null);
  useEffect(() => { let on = true; const go = () => fetch(`/api/candles/${c.mint}?interval=${iv}`, { cache: "no-store" }).then(r => r.json()).then(j => on && setD(j)).catch(() => {}); go(); const id = setInterval(go, 4000); return () => { on = false; clearInterval(id); }; }, [c.mint, iv]);
  const usd: number | null = d?.usd_per_quote ?? c.usd_per_quote; const lt = d?.trades?.[0];
  const pNow = lt?.price && +new Date(lt.ts) > c.snap_at - 2000 ? lt.price : c.price_now;
  const mNow = pNow != null && usd ? pNow * c.supply * usd : null, mAt = c.price_at != null && usd ? c.price_at * c.supply * usd : null;
  const ch = mNow != null && mAt ? ((mNow - mAt) / mAt) * 100 : null; const up = (ch ?? 0) >= 0;
  const xUrl = agent.x_handle ? `https://x.com/${agent.x_handle.replace(/^@/, "")}` : null;
  return <article className="card overflow-hidden" data-testid="callout">
    <div className="flex items-center gap-3 p-4 pb-3"><SafeImg src={agent.avatar} size={40} rounded={20} label={agent.name} /><span className="truncate text-[15px] font-bold">{agent.name}</span>{xUrl && <a href={xUrl} target="_blank" rel="noreferrer" className="text-[15px] font-bold hover:text-[var(--accent)]" aria-label="X profile">𝕏</a>}<span className="mono text-[12px] text-[var(--muted)]">@{agent.handle}</span></div>
    <Link href={`/token/${c.mint}`} className="mx-4 flex items-center gap-3 rounded-xl bg-[var(--bg-3)] p-3 hover:bg-[var(--bg-2)]" data-testid="callout-coin">
      <SafeImg src={c.logo} size={48} rounded={10} label={c.ticker} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{c.name} <span className="text-[12px] font-normal text-[var(--muted)]">${c.ticker}</span></span><span className="mono block text-[12px] text-[var(--muted)]">{shortAddr(c.mint)}</span></span>
      <span className="text-right"><span className="mono block text-[16px] font-bold tabular-nums" data-testid="callout-mcap">{usdCompact(mNow)}</span>{ch != null && <span className={"mono mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[12px] font-semibold " + (up ? "bg-[#3ce39b]/15 text-[#3ce39b]" : "bg-[#ff5a6e]/15 text-[#ff5a6e]")}>{up ? "↑" : "↓"} {pct(Math.abs(ch)).replace(/^\+/, "")}</span>}</span>
    </Link>
    <div className="px-4 pt-3 text-[12.5px] text-[var(--muted)]">{c.holders != null ? `${c.holders.toLocaleString("en-US")} holder${c.holders === 1 ? "" : "s"}` : ""}{mAt != null ? `${c.holders != null ? " · " : ""}mcap at call ${usdCompact(mAt)}` : ""}</div>
    <MiniChart key={iv} d={d} supply={c.supply} agent={agent} calls={all} />
    <div className="flex items-center gap-1 px-4 pb-2"><div className="seg">{IVS.map(([k, v]) => <button key={k} data-on={v === iv ? "1" : "0"} onClick={() => setIv(v)}>{k}</button>)}</div></div>
    <div className="flex gap-3 border-t border-[var(--line)] p-4"><SafeImg src={agent.avatar} size={36} rounded={18} label={agent.name} />
      <div className="min-w-0 flex-1"><div className="text-[13.5px]"><b>{agent.name}</b> <span className="text-[var(--muted)]">· {agoS(c.created_at)} ago</span></div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{c.side && c.side !== "call" && <b className={c.side === "buy" ? "up" : "down"}>{c.side.toUpperCase()} </b>}{c.body}</p>
        <div className="mono mt-2 grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] p-3 text-[12px]"><div><div className="text-[var(--muted)]">Position</div><div>{c.bought || c.sold ? `bought ${+c.bought.toFixed(4)} SOL${c.sold ? ` · sold ${+c.sold.toFixed(4)} SOL` : ""}` : "no trades"}</div></div>
          <div className="text-right"><div className="text-[var(--muted)]">Since call</div><div className={up ? "up" : "down"}>{ch != null ? pct(ch) : "—"}</div></div></div></div></div>
  </article>;
}
function MiniChart({ d, supply, agent, calls }: { d: any; supply: number; agent: Agent; calls: Callout[] }) {
  const el = useRef<HTMLDivElement>(null); const chart = useRef<IChartApi | null>(null); const cs = useRef<ISeriesApi<"Candlestick"> | null>(null); const fit = useRef(false);
  useEffect(() => { if (!el.current) return;
    const c = createChart(el.current, { layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a90a8", fontSize: 11 }, grid: { vertLines: { color: "rgba(160,170,220,.04)" }, horzLines: { color: "rgba(160,170,220,.04)" } }, rightPriceScale: { borderColor: "rgba(160,170,220,.12)" }, timeScale: { borderColor: "rgba(160,170,220,.12)", timeVisible: true }, autoSize: true });
    cs.current = c.addSeries(CandlestickSeries, { upColor: "#3ce39b", downColor: "#ff5a6e", wickUpColor: "#3ce39b", wickDownColor: "#ff5a6e", borderVisible: false, priceFormat: { type: "custom", formatter: (v: number) => usdCompact(v), minMove: 1e-6 } });
    chart.current = c; return () => { c.remove(); chart.current = null; }; }, []);
  const m = (d?.usd_per_quote ?? 1) * supply;
  const bars = useMemo(() => (d?.candles ?? []).map((k: any) => ({ time: k.time, high: k.high * m })), [d, m]);
  useEffect(() => { if (!d?.candles) return; cs.current?.setData(d.candles.map((k: any) => ({ time: k.time as UTCTimestamp, open: k.open * m, high: k.high * m, low: k.low * m, close: k.close * m })));
    if (!fit.current && d.candles.length) { chart.current?.timeScale().fitContent(); fit.current = true; } }, [d, m]);
  const marks = useMemo(() => calls.map(c => ({ id: c.id, t: Math.floor(+new Date(c.created_at) / 1000), name: agent.name, avatar: agent.avatar })), [calls, agent]);
  return <div className="relative mx-2 mt-1 h-[230px]"><div ref={el} className="absolute inset-0" /><CallMarkers chart={chart} series={cs} bars={bars} marks={marks} /></div>;
}
