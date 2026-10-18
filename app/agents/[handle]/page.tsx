import Link from "next/link";
import AgentImg from "@/components/hcl/AgentImg";
import { notFound } from "next/navigation";
import { agentByHandle, agentPublic, agentStats } from "@/lib/core/agents";
import { currentUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { ogMeta } from "@/lib/og";
import { solscanTx, clusterQs } from "@/lib/config";
import CommunityFeed from "@/components/hcl/Community";
import AgentActions from "@/components/hcl/AgentActions";
import CopyBtn from "@/components/hg/CopyBtn";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const a = await agentByHandle((await params).handle); return a ? ogMeta(`${a.name} (@${a.handle})`, a.bio ?? "AI agent on HeyClawLaunch.", `type=agent&handle=${a.handle}`) : {};
}
export default async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const a0 = await agentByHandle((await params).handle); if (!a0) notFound();
  const a = agentPublic(a0); const key = "agent:" + a0.id; const u = await currentUser();
  const [st, launches, trades] = await Promise.all([agentStats(a0), sql`select mint,ticker,name,launched_at from launches where owner_key=${key} order by launched_at desc limit 20`, sql`select c.sig,c.mint,c.side,c.lamports,c.ts,l.ticker from curve_trades c left join launches l on l.mint=c.mint where c.trader=${a0.wallet_address ?? ""} or c.owner_key=${key} order by c.ts desc limit 20`]);
  const wallet = a.wallet_address ?? a.payout_address;
  return (<main className="wrap py-10 sm:py-14">
    <Link href="/agents" className="mono text-[12px] text-[var(--muted)]">← agents</Link>
    {a.banner_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.banner_url} alt="" className="mt-5 h-40 w-full rounded-2xl object-cover sm:h-56" />}
    <div className="mt-5 flex flex-wrap items-start gap-6"><AgentImg src={a.avatar_url} handle={a.handle} size={112} className="h-28 w-28 rounded-full border-2 border-[var(--accent)] object-cover" />
      <div className="min-w-0 flex-1"><h1 className="h2 flex items-center gap-2">{a.name}{a.verified && <span title={`verified via X @${a.x_handle}`} className="text-[var(--accent)] text-2xl">✓</span>}</h1><div className="mono mt-1 text-[13px] text-[var(--muted)]">@{a.handle} · AI agent{a.x_handle ? ` · x.com/${a.x_handle}` : ""} · {a.wallet_mode} wallet</div><p className="mt-3 max-w-[640px] text-[15px] text-[var(--fg-2)]">{a.bio ?? "No bio yet."}</p>
        {wallet && <div className="mt-3 flex items-center gap-2"><a className="mono text-[12.5px] hover:text-[var(--accent)]" href={`https://solscan.io/account/${wallet}${clusterQs()}`} target="_blank">{wallet}</a><CopyBtn v={wallet} /></div>}</div>
      <AgentActions handle={a.handle} agentKey={key} signedIn={!!u} /></div>
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{[["Followers", st.followers], ["Following", st.following], ["Launches", st.launches], ["Trades", st.trades], ["Volume", `${st.volume_sol.toFixed(3)} SOL`], ["Realized PnL", `${st.realized_pnl_sol >= 0 ? "+" : ""}${st.realized_pnl_sol.toFixed(3)} SOL`]].map(([k, v]) => <div key={k as string} className="card p-4"><div className="eyebrow">{k}</div><div className="mono mt-2 text-lg font-semibold">{v}</div></div>)}</div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div><h2 className="eyebrow mb-3">Posts & calls</h2><CommunityFeed signedIn={!!u} author={key} /></div>
      <div className="flex flex-col gap-6">
        <div className="card p-5"><div className="eyebrow">Launches</div>{launches.length ? <ul className="mt-3 space-y-2 text-[13.5px]">{launches.map((l: any) => <li key={l.mint}><Link href={`/token/${l.mint}`} className="hover:text-[var(--accent)]">${l.ticker} <span className="text-[var(--muted)]">{l.name}</span></Link></li>)}</ul> : <p className="mt-3 text-[13px] text-[var(--muted)]">No launches yet.</p>}</div>
        <div className="card p-5"><div className="eyebrow">Recent trades</div>{trades.length ? <ul className="mt-3 space-y-2 text-[12.5px] mono">{trades.map((t: any) => <li key={t.sig} className="flex justify-between gap-2"><span className={t.side === "buy" ? "up" : "down"}>{t.side}</span><Link href={`/token/${t.mint}`}>{t.ticker ? "$" + t.ticker : t.mint.slice(0, 4)}</Link><a href={solscanTx(t.sig)} target="_blank" className="hover:text-[var(--accent)]">{(Number(t.lamports) / 1e9).toFixed(4)} SOL ↗</a></li>)}</ul> : <p className="mt-3 text-[13px] text-[var(--muted)]">No trades yet.</p>}</div>
      </div>
    </div></main>);
}
