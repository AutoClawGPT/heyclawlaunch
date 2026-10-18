"use client";
import { useState } from "react";
import { getWallets } from "@wallet-standard/app";
import CopyBtn from "@/components/hg/CopyBtn";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export default function SettingsClient({ me }: { me: { custodial: string; balance: number; wallet: string | null; x: string | null } }) {
  const [step, setStep] = useState<"idle" | "warn" | "shown">("idle"); const [ok, setOk] = useState(false); const [secret, setSecret] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [hide, setHide] = useState(true);
  async function reveal() {
    setBusy(true); setErr("");
    try {
      const c = await fetch("/api/settings/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step: "challenge" }) }).then(r => r.json());
      let body: any = { step: "reveal", i_understand: true };
      if (c.mode === "siws") {
        const w: any = getWallets().get().find((x: any) => x.chains?.some((ch: string) => ch.startsWith("solana:")) && x.features["solana:signMessage"]);
        if (!w) throw new Error("Open the wallet you signed in with (Phantom, Solflare or Backpack) to re-authenticate.");
        const { accounts } = await w.features["standard:connect"].connect(); const account = accounts.find((a: any) => a.address === me.wallet) ?? accounts[0];
        if (account.address !== me.wallet) throw new Error(`Switch your wallet to ${me.wallet} and try again.`);
        const msg = new TextEncoder().encode(c.text); const [s] = await w.features["solana:signMessage"].signMessage({ account, message: msg });
        body = { ...body, address: account.address, signedMessage: b64(s.signedMessage ?? msg), signature: b64(s.signature) };
      } else if (!c.ok) throw new Error("For safety, sign in again (in the last 10 minutes) before exporting.");
      const r = await fetch("/api/settings/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setSecret(j.secret); setStep("shown");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="card p-6"><div className="eyebrow">Your HeyClawLaunch wallet</div><div className="mono mt-4 break-all text-[15px]">{me.custodial}</div><div className="mt-2 flex items-center gap-3"><CopyBtn v={me.custodial} /><a className="link text-[13px]" target="_blank" rel="noreferrer" href={`https://solscan.io/account/${me.custodial}?cluster=devnet`}>Solscan ↗</a></div>
      <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--bg-3)] p-4"><div className="mono text-[11px] uppercase text-[var(--muted)]">Balance</div><div className="display mt-1 text-[24px] font-bold">{me.balance.toFixed(4)} <span className="text-[14px] text-[var(--muted)]">SOL</span></div></div><div className="rounded-xl bg-[var(--bg-3)] p-4"><div className="mono text-[11px] uppercase text-[var(--muted)]">Signed in as</div><div className="mt-1 truncate font-semibold">{me.x ? `@${me.x}` : me.wallet ? `${me.wallet.slice(0, 4)}…${me.wallet.slice(-4)}` : "—"}</div></div></div>
      <p className="mt-5 text-[13px] text-[var(--fg-2)]">Deposit devnet SOL to this address to pay for volume bots. Your 80% creator fees land here when you claim. Claim, withdraw and swap from <a className="link" href="/claim">Claim</a>, the Telegram bot, or your AI.</p></section>
    <section className="card p-6"><div className="eyebrow !text-[var(--claw)]">Danger zone</div><h2 className="display mt-3 text-[22px] font-semibold">Export private key</h2><p className="mt-2 text-[14px] text-[var(--fg-2)]">Import your wallet into Phantom, Solflare or Backpack. Anyone with this key controls the wallet and everything in it, forever. We will never ask you for it.</p>
      {step === "idle" && <button className="btn-ghost btn-big mt-5 !border-[var(--claw)] !text-[var(--claw)]" onClick={() => setStep("warn")}>Reveal private key…</button>}
      {step === "warn" && <div className="mt-5 rounded-xl border border-[var(--claw)]/40 bg-[rgba(255,79,123,.06)] p-4"><label className="flex gap-3 text-[13.5px]"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-1" />I understand: never share this key, never paste it into a website or chat, and HeyClawLaunch staff will never ask for it.</label><div className="mt-4 flex gap-2"><button className="btn-accent" disabled={!ok || busy} onClick={reveal}>{busy ? "Re-authenticating…" : me.wallet ? "Re-sign with wallet & reveal" : "Reveal"}</button><button className="btn-ghost" onClick={() => setStep("idle")}>Cancel</button></div></div>}
      {step === "shown" && <div className="mt-5"><div className="relative rounded-xl bg-[var(--bg)] p-4"><div className={"mono break-all text-[12.5px] " + (hide ? "select-none blur-sm" : "")}>{secret}</div></div><div className="mt-3 flex gap-2"><button className="btn-ghost" onClick={() => setHide(h => !h)}>{hide ? "Show" : "Hide"}</button><CopyBtn v={secret} /><button className="btn-ghost" onClick={() => { setSecret(""); setStep("idle"); setHide(true); }}>Done</button></div><p className="mt-2 text-[12px] text-[var(--muted)]">Base58 secret key. Paste it in your wallet app under “Import private key”.</p></div>}
      {err && <p className="down mt-3 text-[13px]">{err}</p>}</section>
  </div>;
}
