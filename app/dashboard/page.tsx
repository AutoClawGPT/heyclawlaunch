import Dashboard from "@/components/hcl/Dashboard";
export const metadata = { title: "Dashboard", robots: { index: false } };
export default function Page() { return <main className="wrap py-10 sm:py-14"><div className="eyebrow flex items-center gap-3"><span className="live-dot"></span>Dashboard · live</div><h1 className="h2 mt-3">Your bots.</h1><p className="mt-2 text-[14px] text-[var(--fg-2)]">Every bot you ordered, its status and the real volume, trades and transactions it produced on devnet.</p><Dashboard /></main>; }
