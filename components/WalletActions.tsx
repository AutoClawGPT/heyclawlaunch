"use client";
import { useState } from "react";
import CopyBox from "@/components/hg/CopyBox";
export default function WalletActions() {
  const [url, setUrl] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true); setErr("");
    try { const r = await fetch("/api/connector-key", { method: "POST" }); const j = await r.json(); if (!r.ok || !j.url) throw new Error(j.error ?? "Couldn't create the URL."); setUrl(j.url); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return url ? <div><CopyBox value={url} label="Copy" /><p className="mono mt-2 text-[11.5px] text-[var(--muted)]">Shown once. Paste it as a custom connector / MCP server URL in Claude, ChatGPT, Cursor or Hermes: no OAuth needed, it acts as your wallet (launch, claim, withdraw, swap, volume bots). Anyone with it can use your wallet, so keep it private; revoke from here any time.</p></div>
    : <div><button className="btn-ghost" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create personal connector URL"}</button>{err && <p className="mono mt-2 text-[12px] text-[var(--claw)]">{err}</p>}</div>;
}
