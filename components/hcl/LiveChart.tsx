"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { ago, sol } from "./ui";
const IVS = ["15s", "1m", "5m", "15m", "1h"];
const fmtP = (p: number) => p >= 1e-3 ? p.toFixed(6) : p.toExponential(3);
/** Real-time OHLC (SOL per token) from indexed devnet curve trades, volume bars, 24h stats and a live trade feed. */
export default function LiveChart({ mint, height = 360, showTrades = true }: { mint: string; height?: number; showTrades?: boolean }) {
  const el = useRef<HTMLDivElement>(null); const chart = useRef<IChartApi | null>(null);
  const cs = useRef<ISeriesApi<"Candlestick"> | null>(null); const vs = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [iv, setIv] = useState("1m"); const [d, setD] = useState<any>(null); const fit = useRef(true);
  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, { height, layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a90a8", fontFamily: "var(--font-code)" }, grid: { vertLines: { color: "rgba(160,170,220,.06)" }, horzLines: { color: "rgba(160,170,220,.06)" } }, rightPriceScale: { borderColor: "rgba(160,170,220,.12)" }, timeScale: { borderColor: "rgba(160,170,220,.12)", timeVisible: true, secondsVisible: true }, crosshair: { mode: 1 }, autoSize: true });
    cs.current = c.addSeries(CandlestickSeries, { upColor: "#3ce39b", downColor: "#ff5a6e", wickUpColor: "#3ce39b", wickDownColor: "#ff5a6e", borderVisible: false, priceFormat: { type: "custom", formatter: fmtP, minMove: 1e-12 } });
    vs.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chart.current = c; return () => { c.remove(); chart.current = null; };
  }, [height]);
  useEffect(() => {
    let on = true; fit.current = true;
    const go = () => fetch(`/api/candles/${mint}?interval=${iv}`, { cache: "no-store" }).then(r => r.json()).then(j => {
      if (!on) return; setD(j);
      cs.current?.setData(j.candles.map((k: any) => ({ time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close })));
      vs.current?.setData(j.candles.map((k: any) => ({ time: k.time as UTCTimestamp, value: k.volume, color: k.close >= k.open ? "rgba(60,227,155,.45)" : "rgba(255,90,110,.45)" })));
      if (fit.current && j.candles.length) { chart.current?.timeScale().fitContent(); fit.current = false; }
    }).catch(() => {});
    go(); const id = setInterval(go, 3000); return () => { on = false; clearInterval(id); };
  }, [mint, iv]);
  const last = d?.candles?.at(-1)?.close, first = d?.candles?.[0]?.open; const chg = last && first ? ((last - first) / first) * 100 : 0;
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><span className="mono text-[20px] font-semibold">{last ? fmtP(last) : "—"} <span className="text-[12px] text-[var(--muted)]">SOL/token</span></span>{last && <span className={"mono text-[13px] " + (chg >= 0 ? "up" : "down")}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>}
        {d?.stats && <span className="mono text-[12px] text-[var(--fg-2)]">vol 1h {sol(d.stats.v1, 3)} · 24h {sol(d.stats.v24, 3)} · {d.stats.n24} trades</span>}</div>
      <div className="seg">{IVS.map(x => <button key={x} data-on={x === iv ? "1" : "0"} onClick={() => setIv(x)}>{x}</button>)}</div>
    </div>
    <div className="relative mt-3"><div ref={el} style={{ height }} />{d?.initial && <div className="mono pointer-events-none absolute left-3 top-2 text-[11px] text-[var(--muted)]">Starting price · first trade will move the chart</div>}</div>
    {showTrades && <div className="mt-4"><div className="eyebrow"><span className="live-dot"></span>Live trades</div><div className="mt-2 max-h-[280px] overflow-y-auto"><table className="w-full text-[12.5px]"><tbody>{!d?.trades?.length ? <tr><td className="py-3 text-[var(--muted)]">No trades yet.</td></tr> : d.trades.map((t: any) => <tr key={t.sig} className="row"><td className={"py-2 pr-3 " + (t.side === "buy" ? "up" : "down")}>{t.side}</td><td className="py-2 pr-3 mono">{sol(t.sol, 4)}</td><td className="py-2 pr-3 mono text-[var(--fg-2)]">{t.tokens ? Math.round(t.tokens).toLocaleString() : ""}</td><td className="py-2 pr-3 mono text-[var(--muted)]">{t.trader.slice(0, 4)}…{t.trader.slice(-4)}</td><td className="py-2 text-right"><a className="mono text-[var(--muted)] hover:text-[var(--accent)]" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}>{ago(t.ts)} ↗</a></td></tr>)}</tbody></table></div></div>}
  </div>;
}
