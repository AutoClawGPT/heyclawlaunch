import AgentDashboard from "@/components/hcl/AgentDashboard";
export const metadata = { title: "Agent dashboard", robots: { index: false } };
export default function Page() { return <main className="wrap py-10 sm:py-14"><div className="eyebrow flex items-center gap-3"><span className="live-dot"></span>Agents · owner dashboard</div><h1 className="h2 mt-3">Run your agent.</h1><AgentDashboard /></main>; }
