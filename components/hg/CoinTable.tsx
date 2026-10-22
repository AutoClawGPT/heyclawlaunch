import Link from "next/link";
import { type Coin, fmtQ, ago, short, feeTo } from "@/lib/core/market";
const G = "grid grid-cols-[22px_minmax(0,1fr)_72px_58px] items-center gap-2.5 px-3 sm:grid-cols-[28px_minmax(0,1fr)_84px_84px_70px_44px] sm:px-4 lg:grid-cols-[28px_minmax(0,1fr)_110px_86px_86px_70px_92px_48px] border-b border-[var(--line)]";
export function CoinImg({ cid, size = 32 }: { cid: string | null; size?: number }) {
  return cid ? <img src={`/api/ipfs/${cid}`} alt="" width={size} height={size} className="shrink-0 bg-[var(--bg-3)] object-cover ring-1 ring-[var(--line)]" style={{ width: size, height: size }} /> : <span className="shrink-0 bg-[var(--bg-3)] ring-1 ring-[var(--line)]" style={{ width: size, height: size, display: "inline-block" }} />;
}
export default function CoinTable({ coins }: { coins: Coin[] }) {
  return (
    <div className="card mono overflow-hidden text-[12.5px] tabular-nums">
      <div className={`${G} py-2.5 text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]`}><span>#</span><span>Coin</span><span className="hidden text-right lg:block">Pair</span><span className="hidden text-right sm:block">Raised</span><span className="text-right">Mcap</span><span className="text-right">Fees</span><span className="hidden pl-3 lg:block">Curve</span><span className="hidden text-right sm:block">Age</span></div>
      {!coins.length && <div className="px-4 py-10 text-center text-[var(--muted)]">No coins yet. Say “launch a coin” to make the first one.</div>}
      {coins.map((c, i) => (
        <Link key={c.mint} className={`${G} py-3 transition-colors last:border-b-0 hover:bg-[var(--bg-3)]`} href={`/token/${c.mint}`}>
          <span className="text-[var(--muted)]">{String(i + 1).padStart(2, "0")}</span>
          <span className="flex min-w-0 items-center gap-3"><CoinImg cid={c.logo_cid} /><span className="block min-w-0 flex-1"><span className="flex items-baseline gap-2"><span className="truncate font-semibold text-[var(--fg)]">{c.name}</span><span className="shrink-0 text-[var(--muted)]">${c.ticker}</span></span><span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{short(c.mint)} · Fees → {c.is_holder_reward ? "holders" : "creator"}</span></span></span>
          <span className="hidden text-right text-[var(--fg-2)] lg:block">{c.pair}</span>
          <span className="hidden text-right sm:block">{fmtQ(c.raisedQuote, "")}</span>
          <span className="text-right">{fmtQ(c.mcapQuote, "")}</span>
          <span className="mono tabular-nums text-right text-[var(--fg-2)]">{feeTo(c)}</span>
          <span className="hidden pl-3 lg:block"><span className="flex items-center gap-2"><span className="relative h-1 flex-1 bg-[var(--line)]"><span className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: `${c.progress}%` }}></span></span><span className="w-8 text-right text-[11px] text-[var(--fg-2)]">{c.complete ? "grad" : `${Math.round(c.progress)}%`}</span></span></span>
          <span className="hidden text-right text-[var(--fg-2)] sm:block">{ago(c.launched_at)}</span>
        </Link>))}
    </div>);
}
export function Marquee({ coins }: { coins: Coin[] }) {
  if (!coins.length) return <div className="marquee overflow-hidden border-y border-[var(--line)]" />;
  const items = [...coins, ...coins, ...coins, ...coins].slice(0, Math.max(20, coins.length * 2));
  return <div className="marquee overflow-hidden border-y border-[var(--line)]"><div className="marquee-track">{[...items, ...items].map((c, i) => <Link key={i} className="mono flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-[var(--line)] px-5 py-3 text-[12px] text-[var(--fg-2)] hover:bg-[var(--bg-3)]" href={`/token/${c.mint}`}><b className="font-semibold text-[var(--fg)]">${c.ticker}</b>{fmtQ(c.mcapQuote)}<span className="mono tabular-nums up ">{Math.round(c.progress)}%</span></Link>)}</div></div>;
}
export function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return <section id={id} className="wrap scroll-mt-24 py-8 sm:py-12"><div className="grid gap-8 border-t border-[var(--fg)] pt-6 lg:grid-cols-[260px_minmax(0,1fr)]"><div className="eyebrow !text-[var(--fg)]">{eyebrow}</div><div><h2 className="h2 max-w-[760px]">{title}</h2><div className="mt-6">{children}</div></div></div></section>;
}
