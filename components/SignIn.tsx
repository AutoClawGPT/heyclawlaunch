"use client";
import { useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export default function SignIn({ xEnabled, returnTo }: { xEnabled: boolean; returnTo: string }) {
  const [wallets, setWallets] = useState<any[]>([]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const w = getWallets(); const upd = () => setWallets(w.get().filter((x: any) => x.chains?.some((c: string) => c.startsWith("solana:")))); upd(); return w.on("register", upd); }, []);
  async function go(w: any) {
    setBusy(true); setErr("");
    try {
      const input = await fetch("/api/siws/input").then(r => r.json());
      let out: { account: { address: string }; signedMessage: Uint8Array; signature: Uint8Array };
      if (w.features["solana:signIn"]) [out] = await w.features["solana:signIn"].signIn(input);
      else {
        const { accounts } = await w.features["standard:connect"].connect(); const account = accounts[0];
        const text = await fetch("/api/siws/input?text=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, address: account.address }) }).then(r => r.text());
        const msg = new TextEncoder().encode(text);
        const [s] = await w.features["solana:signMessage"].signMessage({ account, message: msg });
        out = { account, signedMessage: s.signedMessage ?? msg, signature: s.signature };
      }
      const r = await fetch("/api/siws/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: out.account.address, signedMessage: b64(out.signedMessage), signature: b64(out.signature) }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "sign-in failed");
      location.href = returnTo;
    } catch (e: any) { setErr(e.message ?? String(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      {wallets.length ? wallets.map(w => <button key={w.name} disabled={busy} onClick={() => go(w)} className="btn-primary btn-big w-full"><img src={w.icon} alt="" className="w-5 h-5" />Sign in with {w.name}</button>)
        : <div className="text-[14px] text-[var(--fg-2)]">No Solana wallet detected. Install Phantom, Solflare or Backpack to sign in with your wallet.</div>}
      {xEnabled && <a className="btn-ghost btn-big w-full" href={`/auth/x/login?return_to=${encodeURIComponent(returnTo)}`}>Continue with X</a>}
      {err && <div className="text-[13px] down">{err}</div>}
    </div>
  );
}
