import Link from "next/link";
import { listCoins } from "@/lib/core/market";
import { sql } from "@/lib/db";
import CoinCards from "@/components/hg/CoinCards";
import { coinStats } from "@/lib/core/coinstats";
import { solUsd } from "@/lib/core/price";
import { ogMeta } from "@/lib/og";
export const metadata = ogMeta("Explore coins", "Every pump.fun coin launched on HeyClawLaunch: live prices, volume and trades.", "type=home");
export const dynamic = "force-dynamic";
type SP = { fee?: string; sort?: string; pair?: string; q?: string };
const on = "border px-2.5 py-1 transition-colors border-[var(--accent)] text-[var(--accent)]", off = "border px-2.5 py-1 transition-colors border-transparent text-[var(--muted)] hover:text-[var(--fg)]";
export default async function Explore({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const coins = await listCoins({ ...sp, sort: sp.sort === "new" ? "new" : sp.sort });
  const [st, usd] = await Promise.all([coinStats(coins.map(c => c.mint)), solUsd()]);
  const pairs: string[] = (await sql`select distinct symbol from pairs order by symbol`.catch(() => [])).map((r: any) => r.symbol).filter(Boolean);
  const href = (o: Partial<SP>) => { const q = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]); const s = q.toString(); return s ? `/explore?${s}` : "/explore"; };
  const sorts: [string | undefined, string][] = [[undefined, "trending"], ["mcap", "market cap"], ["new", "newest"], ["graduating", "near graduation"]];
  return (
    <main className="wrap py-12 sm:py-16"><div className="eyebrow ">Explore · live</div><h1 className="h2 mt-3">Every coin launched through HeyClawLaunch.</h1><p className="mt-3 text-[var(--fg-2)]">Live from pump.fun on Solana.</p>
      <div className="mt-8 card"><div className="chrome"><span className="flex gap-1.5"><i></i><i></i><i></i></span><span className="min-w-0 truncate">explore · {coins.length} coins</span><span className="ml-auto shrink-0 text-[var(--muted)]">live</span></div>
        <div className="tabs">{sorts.map(([k, t]) => <Link key={t} aria-current={sp.sort === k ? "true" : undefined} href={href({ sort: k })}>{t}</Link>)}</div>
        <form className="flex items-center gap-3 border-b border-[var(--line)] px-4" action="/explore"><span className="mono text-[var(--accent)]">&gt;</span><input defaultValue={sp.q} placeholder="Search a name, $ticker or mint…" className="mono h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]" name="q" /><button className="btn-primary !h-9">Search</button></form>
        <div className="mono flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 text-[12px]"><span className="eyebrow mr-2">Fees</span>{[["", "all"], ["x", "to X account"], ["wallet", "to wallet"], ["holders", "to holders"]].map(([k, t]) => <Link key={t} className={(sp.fee ?? "") === k ? on : off} href={href({ fee: k })}>{t}</Link>)}
          <span className="eyebrow ml-4 mr-2">Pair</span>{["", ...pairs].map(k => <Link key={k || "all"} className={(sp.pair ?? "") === k ? on : off} href={href({ pair: k })}>{k || "all"}</Link>)}</div></div>
      <div className="mt-4"><CoinCards coins={coins} stats={st} usd={usd} /></div></main>);
}
