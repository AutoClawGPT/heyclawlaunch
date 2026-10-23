import Link from "next/link";
import type { Coin } from "@/lib/core/market";
import type { CoinStat } from "@/lib/core/coinstats";
import SafeImg from "./SafeImg";
import { usdCompact, pct, shortAddr, agoS } from "@/lib/fmt";
function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (pts.length < 2) return <svg viewBox="0 0 100 28" className="h-7 w-full"><line x1="0" y1="20" x2="100" y2="20" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>;
  const lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || hi || 1;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${26 - ((p - lo) / r) * 24}`).join(" ");
  const c = up ? "#3ce39b" : "#ff5a6e";
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full"><polyline points={d} fill="none" stroke={c} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}
/** pump.fun / DexScreener style coin cards: grid on desktop, compact list rows on mobile. */
export default function CoinCards({ coins, stats, usd }: { coins: Coin[]; stats: Map<string, CoinStat>; usd: number | null }) {
  if (!coins.length) return <div className="card px-4 py-10 text-center text-[var(--muted)]">No coins match. Say “launch a coin” to make one.</div>;
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
    {coins.map(c => { const s = stats.get(c.mint); const pq = c.mcapQuote != null ? c.mcapQuote / 1e9 : null; const chg = s?.open24 && pq != null ? ((pq - s.open24) / s.open24) * 100 : s ? 0 : null; const up = (chg ?? 0) >= 0;
      return <Link key={c.mint} href={`/token/${c.mint}`} data-testid="coin-card" className="card group flex min-w-0 gap-3 p-3 transition-colors hover:border-[var(--accent)] sm:flex-col sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
          <SafeImg src={c.logo_cid ? `/api/ipfs/${c.logo_cid}` : null} size={52} rounded={12} label={c.ticker} />
          <div className="min-w-0 flex-1"><div className="flex items-baseline gap-1.5"><span className="truncate font-bold">{c.name}</span><span className="mono shrink-0 text-[12px] text-[var(--muted)]">${c.ticker}</span></div>
            <div className="mono mt-0.5 truncate text-[11px] text-[var(--muted)]">by {shortAddr(c.recipient ?? c.creator)} · {agoS(c.launched_at)} ago</div>
            <div className="mono mt-1 flex items-baseline gap-2 text-[12.5px] sm:hidden"><span className="font-semibold">{usdCompact(c.mcapUsd)}</span><span className={up ? "up" : "down"}>{pct(chg)}</span></div></div>
        </div>
        <div className="hidden sm:block"><div className="flex items-end justify-between"><div><div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Market cap</div><div className="mono text-[18px] font-bold tabular-nums">{usdCompact(c.mcapUsd)}</div></div><span className={"mono text-[13px] font-semibold tabular-nums " + (up ? "up" : "down")}>{pct(chg)}</span></div>
          <div className="mt-1"><Spark pts={s?.spark ?? []} up={up} /></div></div>
        <div className="flex w-[96px] shrink-0 flex-col overflow-hidden justify-center gap-1 sm:w-auto">
          <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full" style={{ width: `${Math.max(2, c.progress)}%`, background: c.complete ? "#3ce39b" : "var(--grad, var(--accent))" }} /></div><span className="mono text-[10.5px] text-[var(--fg-2)]">{c.complete ? "grad" : `${Math.round(c.progress)}%`}</span></div>
          <div className="mono flex justify-between gap-2 text-[10.5px] text-[var(--muted)]"><span>vol {usd && s ? usdCompact(s.v24 * usd) : "—"}</span><span className="hidden sm:inline">{s?.n24 ?? 0} txns</span><span className="hidden sm:inline">{s?.replies ?? 0} replies</span></div>
        </div>
      </Link>; })}
  </div>;
}
