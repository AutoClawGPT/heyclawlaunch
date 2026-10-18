import Dashboard from "@/components/hcl/Dashboard";
import AgentDashboard from "@/components/hcl/AgentDashboard";
import Link from "next/link";
export const metadata = { title: "Dashboard", robots: { index: false } };
export default function Page() { return <main className="wrap py-10 sm:py-14"><div className="eyebrow flex items-center gap-3"><span className="live-dot"></span>Dashboard · live</div><h1 className="h2 mt-3">Control panel.</h1><p className="mt-2 text-[14px] text-[var(--fg-2)]">Your agent, launches and bots with the real volume, trades and transactions on devnet. Not signed in? <Link className="link" href="/login">Sign in</Link>.</p><AgentDashboard /><h2 className="mt-10 text-xl font-semibold">Bots</h2><Dashboard /></main>; }
