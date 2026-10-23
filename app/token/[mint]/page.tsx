import Link from "next/link";
import { notFound } from "next/navigation";
import TokenTerminal from "@/components/hcl/TokenTerminal";
import { coinInfo, holderCount } from "@/lib/core/coin";
import { coinUsd } from "@/lib/core/price";
import { clusterQs } from "@/lib/config";
import { bondingCurvePda } from "@/lib/solana/pump";
import { PublicKey } from "@solana/web3.js";
export const revalidate = 3; // ISR: the chart/feed refresh client-side
const renderedAt = () => Date.now(); // snapshot time of the curve/pool reserves below; newer live trades override it client-side
export async function generateStaticParams() { return []; } // on-demand ISR per mint
import { ogMeta } from "@/lib/og";
import { sql } from "@/lib/db";
export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params; const [l] = await sql`select l.name,l.ticker,d.description from launches l left join drafts d on d.id=l.draft_id where l.mint=${mint}`.catch(() => []);
  return l ? ogMeta(`${l.name} ($${l.ticker})`, (l.description || `$${l.ticker} on pump.fun, launched with HeyClawLaunch.`).slice(0, 180), `type=token&mint=${mint}`) : {};
}
export default async function Token({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params; if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) notFound(); const i = await coinInfo(mint); const l = i.launch; const cv = i.curve; if (!l) notFound();
  let curvePk = ""; try { curvePk = bondingCurvePda(new PublicKey(mint)).toBase58(); } catch {}
  const pair = l?.pair_symbol ?? "SOL"; const holders = !!l?.is_holder_reward; const xFee = !!l?.fee_label?.startsWith("@");
  const prog = cv?.progress ?? 0;
  const [px, hc] = await Promise.all([coinUsd(mint, cv?.priceQuote ?? null, { vq0: cv?.vq0, quote: pair, supply: cv?.supply ?? 1e9 }), holderCount(mint)] as const);
  const priceUsd = cv ? px.priceUsd : null;
    const pump = `https://pump.fun/coin/${mint}`;
  const [dr] = l.draft_id ? await sql`select description, x, website, telegram from drafts where id=${l.draft_id}`.catch(() => [] as any[]) : [];
  const liqQuote = cv ? (cv.venue === "pumpswap" ? (cv.poolQuote ?? 0) : (cv.realQuote ?? 0)) / 1e9 : 0;
  const usdPerQuote = priceUsd != null && cv?.priceQuote ? priceUsd / cv.priceQuote : null;
  return (
    <main className="wrap py-6 sm:py-8"><div className="flex items-center justify-between gap-3"><Link className="mono text-[12px] text-[var(--muted)] hover:text-[var(--accent)]" href="/explore">← explore</Link>
      <div className="flex gap-2"><a href={`https://solscan.io/token/${mint}${clusterQs()}`} target="_blank" rel="noreferrer" className="btn-ghost mono !h-9 !px-3 text-[12px]">Solscan ↗</a><Link href={`/bots?mint=${mint}`} className="btn-accent !h-9 !px-3 text-[12px]">Boost</Link><a href={pump} target="_blank" rel="noreferrer" className="btn-ghost !h-9 !px-3 text-[12px]">pump.fun ↗</a></div></div>
      <div className="mt-4"><TokenTerminal mint={mint} snapAt={renderedAt()} name={l.name} ticker={l.ticker} logo={l.logo_cid ? `/api/ipfs/${l.logo_cid}` : null} pair={pair} supply={cv?.supply ?? 1e9} priceQuote={cv?.priceQuote ?? null} usdPerQuote={usdPerQuote} complete={!!cv?.complete} progress={prog} liqQuote={liqQuote} holders={hc} pool={cv?.pool ?? null} creator={cv?.creator ?? l.creator ?? null} launchedAt={l.launched_at ? new Date(l.launched_at).toISOString() : null}
        description={dr?.description ?? null} x={dr?.x ?? null} website={dr?.website ?? null} telegram={dr?.telegram ?? null} shares={(i.shares ?? []).map((s: any) => ({ address: s.address, bps: s.bps }))} feeTo={holders ? "Paid to holders through pump.fun" : `80% to ${xFee ? l.fee_label.split(" ")[0] : "the fee wallet"}, 20% to the platform`} curve={curvePk || null} createSig={l.create_sig ?? null} /></div>
    </main>);
}
