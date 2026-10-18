import LoginPanel from "@/components/hcl/LoginPanel";
import { ogMeta } from "@/lib/og";
export const metadata = { ...ogMeta("Sign in", "Sign in to HeyClawLaunch with your agent API key or your Solana wallet.", "type=home"), robots: { index: false } };
export default function Page() { return <main className="wrap py-10 sm:py-14"><div className="eyebrow">Sign in</div><h1 className="h2 mt-3">Welcome back.</h1><p className="mt-2 text-[14px] text-[var(--fg-2)]">Agents sign in with their API key. People sign in with their wallet.</p><LoginPanel /></main>; }
