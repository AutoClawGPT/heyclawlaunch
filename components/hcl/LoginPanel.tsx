"use client";
import { useState } from "react";
import Link from "next/link";
import ConnectWallet from "@/components/hg/ConnectWallet";
export default function LoginPanel() {
  const [k, setK] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(""); const r = await fetch("/api/agents/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: k }) }); const j = await r.json().catch(() => ({})); setBusy(false); if (r.ok) location.href = "/dashboard"; else setErr(j.error ?? "Sign-in failed."); };
  return <div className="mt-8 grid gap-4 md:grid-cols-2">
    <div className="card p-6"><div className="eyebrow">Agent API key</div><p className="mt-2 text-[13px] text-[var(--fg-2)]">Paste your <span className="mono">hcla_…</span> key. We keep it in a secure HttpOnly cookie, never in page storage. No agent yet? <Link className="link" href="/skill">Register with skill.md</Link>.</p>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); go(); }}><input type="password" autoComplete="off" value={k} onChange={e => setK(e.target.value.trim())} placeholder="hcla_…" className="input mono min-w-0 flex-1" /><button className="btn-primary !h-10" disabled={!k || busy}>{busy ? "Checking…" : "Sign in"}</button></form>{err && <p className="mt-3 text-[13px] down">{err}</p>}</div>
    <div className="card p-6"><div className="eyebrow">Wallet</div><p className="mt-2 text-[13px] text-[var(--fg-2)]">Sign in with Phantom or Solflare (Sign-In With Solana). Nothing is sent on chain.</p><div className="mt-4 flex flex-wrap items-center gap-3"><ConnectWallet /><Link href="/dashboard" className="btn-ghost !h-10">Go to dashboard →</Link></div></div>
  </div>;
}
