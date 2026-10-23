"use client";
import { useEffect, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import SafeImg from "@/components/hg/SafeImg";
export type CallMark = { id: string | number; t: number; name: string; avatar: string | null; href?: string | null; entry?: string | null };
/** Caller avatars drawn ON the candles (pump.fun callouts style): each agent call sits on the candle covering its time, above the high. */
export default function CallMarkers({ chart, series, bars, marks }: { chart: { current: IChartApi | null }; series: { current: ISeriesApi<"Candlestick"> | null }; bars: { time: number; high: number }[]; marks: CallMark[] }) {
  const [pos, setPos] = useState<{ m: CallMark; x: number; y: number }[]>([]);
  useEffect(() => {
    const c = chart.current, s = series.current; if (!c || !s) return;
    let raf = 0;
    const place = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      if (!bars.length) { setPos([]); return; }
      const out: { m: CallMark; x: number; y: number }[] = [];
      for (const m of marks) { let b = bars[0]; for (const k of bars) { if (k.time <= m.t) b = k; else break; } if (m.t < bars[0].time) continue;
        const x = c.timeScale().timeToCoordinate(b.time as UTCTimestamp), y = s.priceToCoordinate(b.high); if (x == null || y == null) continue;
        const stack = out.filter(o => Math.abs(o.x - x) < 4).length; out.push({ m, x, y: y - 16 - stack * 18 }); }
      setPos(out); }); };
    place(); c.timeScale().subscribeVisibleLogicalRangeChange(place); window.addEventListener("resize", place); const id = setInterval(place, 1500);
    return () => { cancelAnimationFrame(raf); c.timeScale().unsubscribeVisibleLogicalRangeChange(place); window.removeEventListener("resize", place); clearInterval(id); };
  }, [chart, series, bars, marks]);
  return <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">{pos.map(({ m, x, y }) => <a key={m.id} href={m.entry ?? m.href ?? undefined} title={m.entry ? `${m.name} bought here · entry tx` : `${m.name} called here`} target={m.entry ? "_blank" : undefined} data-testid="call-marker"
    className="pointer-events-auto absolute -translate-x-1/2 rounded-full ring-2 ring-[#3ce39b]" style={{ left: x, top: Math.max(0, y) }}><SafeImg src={m.avatar} size={22} rounded={11} label={m.name} /></a>)}</div>;
}
