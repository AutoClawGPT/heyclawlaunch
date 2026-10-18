"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const s = (n: number) => `${Number(n.toFixed(6))} SOL`;
async function j(url: string, body?: any) { const r = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error ?? `HTTP ${r.status}`); return x; }
function Fees({ fees, onClaim, busy }: { fees: any[]; onClaim?: (mint: string) => void; busy?: string }) {
  if (!fees.length) return <p className="mt-3 text-[13px] text-[var(--muted)]">No coins pay this wallet yet.</p>;
  return <div className="mt-3 divide-y divide-[var(--line)]">{fees.map(f => <div key={f.mint} className="flex flex-wrap items-center gap-3 py-3 text-[13.5px]"><Link href={`/token/${f.mint}`} className="font-semibold hover:text-[var(--accent)]">${f.ticker}</Link><span className="mono text-[12px] text-[var(--muted)]">claimable {s(f.claimable_sol)} · claimed {s(f.claimed_sol)}{f.split !== "done" ? ` · fee split ${f.split}` : ""}</span>{onClaim && <button disabled={!f.can_claim || busy === f.mint} onClick={() => onClaim(f.mint)} className="btn-primary !h-8 ml-auto disabled:opacity-40">{busy === f.mint ? "Claiming…" : f.can_claim ? "Claim" : "Below minimum"}</button>}</div>)}</div>;
}
function Results({ r }: { r: any[] }) { return r?.length ? <ul className="mt-3 space-y-1 text-[13px]">{r.map((x, i) => <li key={i}>${x.ticker}: {x.sig ? <a className="text-[var(--accent)]" href={x.url} target="_blank">+{s(x.sol)} · tx ↗</a> : x.note}</li>)}</ul> : null; }
/** Claim for payout-wallet launches: by connected wallet (no code) or by wallet + one-time claim code. */
export default function ClaimPanel({ wallet }: { wallet?: string | null }) {
  const [mine, setMine] = useState<any>(null); const [busy, setBusy] = useState(""); const [res, setRes] = useState<any[]>([]); const [err, setErr] = useState("");
  const [w, setW] = useState(""); const [code, setCode] = useState(""); const [cf, setCf] = useState<any>(null); const [cres, setCres] = useState<any[]>([]); const [cerr, setCerr] = useState(""); const [cbusy, setCbusy] = useState(false);
  useEffect(() => { if (wallet) j("/api/claim/wallet").then(setMine).catch(e => setErr(e.message)); }, [wallet]);
  return (<div className="grid gap-6 lg:grid-cols-2">
    {wallet && <div className="card p-5"><div className="eyebrow">Your connected wallet</div><p className="mono mt-2 break-all text-[12px] text-[var(--fg-2)]">{wallet}</p><p className="mt-2 text-[13px] text-[var(--fg-2)]">Coins that pay this wallet. Connected, so no code needed.</p>{mine ? <Fees fees={mine.fees} busy={busy} onClaim={async m => { setBusy(m); setErr(""); try { const r = await j("/api/claim/wallet", { mint: m }); setRes(r.claimed); setMine(r); } catch (e: any) { setErr(e.message); } finally { setBusy(""); } }} /> : <p className="mt-3 text-[13px] text-[var(--muted)]">Loading on-chain fees…</p>}<Results r={res} />{err && <p className="mt-2 text-[12.5px] down">{err}</p>}</div>}
    <div className="card p-5"><div className="eyebrow">Claim with a code</div><p className="mt-2 text-[13px] text-[var(--fg-2)]">Launched with only a payout wallet (Telegram, an AI or an agent)? Paste that wallet and the one-time claim code you got at launch.</p>
      <form className="mt-3 flex flex-col gap-2" onSubmit={async e => { e.preventDefault(); setCerr(""); setCbusy(true); setCres([]); try { setCf(await j("/api/claim/code", { wallet: w, code })); } catch (x: any) { setCerr(x.message); setCf(null); } finally { setCbusy(false); } }}>
        <input className="input mono" placeholder="payout wallet address" value={w} onChange={e => setW(e.target.value.trim())} /><input className="input mono" placeholder="HCL-XXXXXX-XXXXXX-XXXXXX-XXXXXX" value={code} onChange={e => setCode(e.target.value.trim())} /><button className="btn-ghost !h-10" disabled={!w || !code || cbusy}>{cbusy && !cf ? "Checking…" : "Show my fees"}</button></form>
      {cf && <><Fees fees={cf.fees} /><button className="btn-primary !h-10 mt-3 w-full" disabled={cbusy || !cf.fees.some((f: any) => f.can_claim)} onClick={async () => { setCbusy(true); setCerr(""); try { const r = await j("/api/claim/code", { wallet: w, code, confirm: true }); setCres(r.claimed); setCf(r); } catch (x: any) { setCerr(x.message); } finally { setCbusy(false); } }}>{cbusy ? "Claiming…" : "Claim to my wallet"}</button></>}
      <Results r={cres} />{cerr && <p className="mt-2 text-[12.5px] down">{cerr}</p>}</div>
  </div>);
}
