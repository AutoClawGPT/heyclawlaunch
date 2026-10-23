import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { ctxForUser } from "@/lib/core/ctx";
import { myWallet } from "@/lib/core/wallet";
import SignIn from "@/components/SignIn";
import ClaimPanel from "@/components/hcl/ClaimPanel";
import WalletActions from "@/components/WalletActions";
import { RobotCard } from "@/components/hg/CallScreen";
import { cfg } from "@/lib/config";
import { ogMeta } from "@/lib/og";
export const metadata = ogMeta("Claim creator fees", "Claim the creator fees of your HeyClawLaunch coins with your wallet or claim code.", "type=home");
export const dynamic = "force-dynamic";
export default async function Claim() {
  const w = `${cfg.appUrl}/mcp/wallet`;
  const u = await currentUser();
  if (!u) return (<main className="wrap py-12 sm:py-12"><div><div className="eyebrow flex items-center gap-3"><span className="live-dot"></span>Claim · any country</div><h1 className="h1 mt-5">Your fees don’t stop<br /><span className="text-outline">at the border.</span></h1><p className="mt-6 max-w-[620px] text-[15px] leading-relaxed text-[var(--fg-2)]">Fees sent to your X account or wallet land in your HeyClawLaunch wallet. Add the connector <span className="mono text-[var(--accent)]">{w}</span> in your AI (one click on Authorize) and just ask: “claim my fees”, “withdraw all my SOL to …”. Or sign in here.</p><div className="mt-8 max-w-[420px]"><SignIn xEnabled={!!process.env.X_CLIENT_ID} returnTo="/claim" /></div></div><section className="mt-12"><ClaimPanel /></section><section className="mt-20 sm:mt-28"><div className="reveal"><div className="eyebrow "><span>01 · </span>Compare</div><h2 className="h2 mt-3">Paid out, wherever you are.</h2></div><div className="mt-8 overflow-x-auto card"><table className="w-full min-w-[520px] text-sm"><thead><tr className="mono border-b border-[var(--line)] text-left text-[11px] uppercase tracking-[0.08em]"><th className="px-5 py-3 font-normal text-[var(--muted)]"></th><th className="px-5 py-3 font-semibold text-[var(--accent)]">HeyClawLaunch</th><th className="px-5 py-3 font-normal text-[var(--muted)]">Payouts via X Money</th></tr></thead><tbody><tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 text-[var(--fg-2)]">Who can get paid</td><td className="px-5 py-3.5">Anyone, any country</td><td className="px-5 py-3.5 text-[var(--muted)]">U.S. residents 18+</td></tr><tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 text-[var(--fg-2)]">What you need</td><td className="px-5 py-3.5">A Solana wallet or your X account</td><td className="px-5 py-3.5 text-[var(--muted)]">X Premium + X Money account</td></tr><tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 text-[var(--fg-2)]">If you don’t claim</td><td className="px-5 py-3.5">It waits for you. No expiry</td><td className="px-5 py-3.5 text-[var(--muted)]">Expires in ~14 days</td></tr><tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 text-[var(--fg-2)]">Paid in</td><td className="px-5 py-3.5">SOL or the coin’s pair asset</td><td className="px-5 py-3.5 text-[var(--muted)]">USD</td></tr></tbody></table></div></section><p className="mt-4 text-[12px] text-[var(--muted)]">Wallet connector for your AI: <span className="mono text-[var(--fg-2)]">{w}</span></p></main>);
  const text = await myWallet(ctxForUser(u, "web")).catch((e: any) => String(e.message));
  return (
    <main className="wrap py-12 sm:py-16"><div className="eyebrow flex items-center gap-3"><span className="live-dot"></span>Claim · your wallet</div>
      <div className="mt-3 flex flex-wrap items-end gap-4"><h1 className="h2">Your HeyClawLaunch wallet.</h1><span className="mono text-[12px] text-[var(--muted)]" style={{ wordBreak: "break-all" }}>{u.x_username ? "@" + u.x_username : u.wallet_address}</span><Link href="/auth/logout" className="btn-ghost !h-9 ml-auto">Sign out</Link></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex flex-col gap-6"><div className="card"><div className="chrome"><span className="flex gap-1.5"><i></i><i></i><i></i></span><span className="min-w-0 truncate">my_wallet</span><span className="ml-auto shrink-0 text-[var(--muted)]">{cfg.cluster}</span></div><pre className="mono p-5 text-[13px] leading-relaxed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</pre></div>
          <div className="card p-5"><div className="eyebrow">Personal connector</div><p className="mt-3 text-[14px] text-[var(--fg-2)]">A private MCP URL for your AI app, no OAuth needed. Treat it like a password.</p><div className="mt-4"><WalletActions /></div></div></div>
        <div className="lg:col-span-2 order-first"><ClaimPanel wallet={u.wallet_address} /></div>
        <div><RobotCard /><p className="mono mt-3 text-[11.5px] text-[var(--muted)]">Say “claim my fees”, “withdraw 0.1 SOL to …” or “swap 1 SOL to USDC”. Claw always shows a preview and asks you to confirm.</p></div>
      </div></main>);
}
