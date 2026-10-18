"use client";
import { useState } from "react";
import CopyBox from "@/components/hg/CopyBox";
export default function WalletActions() {
  const [url, setUrl] = useState("");
  return url ? <div><CopyBox value={url} label="Copy" /><p className="mono mt-2 text-[11.5px] text-[var(--muted)]">Shown once. Paste it as a custom connector URL.</p></div>
    : <button className="btn-ghost" onClick={async () => setUrl((await fetch("/api/connector-key", { method: "POST" }).then(r => r.json())).url)}>Create personal connector URL</button>;
}
