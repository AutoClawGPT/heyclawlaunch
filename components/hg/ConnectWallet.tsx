"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SignIn from "@/components/SignIn";
/** Header wallet button: Phantom / Solflare / Backpack via Wallet Standard + Sign-In-With-Solana. */
export default function ConnectWallet() {
  const [me, setMe] = useState<any>(null); const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/me").then(r => r.json()).then(setMe).catch(() => setMe({ signedIn: false })); }, []);
  if (!me) return <span className="hidden sm:block w-[92px]" />;
  if (me.signedIn) { const w = me.user?.wallet as string | null; return <Link href="/claim" className="hidden sm:flex h-[36px] items-center gap-2 rounded-[10px] border border-[var(--line-2)] px-3 text-[12px] mono hover:border-[var(--accent)]" title="Your launches and claims"><span className="live-dot"></span>{w ? `${w.slice(0, 4)}…${w.slice(-4)}` : me.user?.x ? "@" + me.user.x : "Account"}</Link>; }
  return (<>
    <button onClick={() => setOpen(true)} className="hidden sm:flex h-[36px] items-center rounded-[10px] border border-[var(--accent)] px-3 text-[12.5px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-3)]">Connect wallet</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}><div className="card w-full max-w-[420px] p-6" onClick={e => e.stopPropagation()}><div className="eyebrow">Connect</div><h3 className="h3 mt-2 text-xl font-semibold">Sign in with your Solana wallet</h3><p className="mt-2 mb-5 text-[13px] text-[var(--fg-2)]">Phantom, Solflare or Backpack. You sign a message, no transaction, no fee. Your launches and claimable fees show up right away.</p><SignIn xEnabled={false} returnTo={typeof window !== "undefined" ? window.location.pathname + window.location.search : "/claim"} /><button onClick={() => setOpen(false)} className="btn-ghost mt-4 w-full">Close</button></div></div>}
  </>);
}
