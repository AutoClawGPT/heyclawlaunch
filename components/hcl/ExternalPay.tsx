"use client";
import { useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import CopyBtn from "@/components/hg/CopyBtn";
/** Pay a bot order from any wallet: exact amount + unique reference. Phantom/Solflare button (Wallet Standard) or paste the tx; auto-detected by polling the reference. */
export default function ExternalPay({ p, onDone }: { p: any; onDone: (t: string) => void }) {
  const [tx, setTx] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [wallets, setWallets] = useState<any[]>([]);
  useEffect(() => { const w = getWallets(); const upd = () => setWallets(w.get().filter((x: any) => x.features?.["solana:signAndSendTransaction"])); upd(); return w.on("register", upd); }, []);
  useEffect(() => { const id = setInterval(async () => { const r = await fetch(`/api/bots/pay?order=${p.order_id}`).then(r => r.json()).catch(() => null); if (r?.status === "queued" || r?.status === "running") { clearInterval(id); onDone(r.text ?? "Paid, bot starting."); } else if (r?.status === "expired") { clearInterval(id); setMsg("This payment request expired. Start a new order."); } }, 5000); return () => clearInterval(id); }, [p.order_id]);
  async function verify() { setBusy(true); setMsg(""); try { const r = await fetch("/api/bots/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: p.order_id, tx }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); if (j.status === "queued") onDone(j.text); else setMsg(j.text); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }
  async function payWith(w: any) {
    setBusy(true); setMsg("");
    try {
      const { PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");
      const { accounts } = await w.features["standard:connect"].connect(); const account = accounts[0];
      const { blockhash } = await fetch("/api/bots/pay?blockhash=1").then(r => r.json());
      const ix = SystemProgram.transfer({ fromPubkey: new PublicKey(account.address), toPubkey: new PublicKey(p.to), lamports: Number(p.lamports) });
      ix.keys.push({ pubkey: new PublicKey(p.reference), isSigner: false, isWritable: false });
      const t = new Transaction({ feePayer: new PublicKey(account.address), recentBlockhash: blockhash }).add(ix);
      const [res] = await w.features["solana:signAndSendTransaction"].signAndSendTransaction({ account, chain: "solana:devnet", transaction: t.serialize({ requireAllSignatures: false, verifySignatures: false }) });
      const bs58 = (await import("bs58")).default; const sig = bs58.encode(res.signature); setTx(sig); setMsg("Sent. Verifying on chain…");
      setTimeout(async () => { const r = await fetch("/api/bots/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: p.order_id, tx: sig }) }); const j = await r.json(); if (j.status === "queued") onDone(j.text); else setMsg(j.error ?? j.text); }, 6000);
    } catch (e: any) { setMsg(e.message ?? String(e)); } finally { setBusy(false); }
  }
  return (<div className="mt-4 rounded-xl border border-[var(--accent)] p-4 text-[13px]" data-testid="external-pay">
    <div className="eyebrow">Pay from any wallet</div>
    <div className="mt-3 space-y-2"><div className="flex items-center justify-between gap-2"><span>Amount</span><span className="mono font-semibold text-[var(--accent)]">{p.amount_sol} SOL</span><CopyBtn v={String(p.amount_sol)} /></div>
      <div className="flex items-center justify-between gap-2"><span>To</span><span className="mono truncate text-[12px]">{p.to}</span><CopyBtn v={p.to} /></div>
      <div className="flex items-center justify-between gap-2"><span>Reference</span><span className="mono truncate text-[12px]">{p.reference}</span><CopyBtn v={p.reference} /></div></div>
    <div className="mt-3 flex flex-wrap gap-2">{wallets.map(w => <button key={w.name} disabled={busy} onClick={() => payWith(w)} className="btn-accent !h-10"><img src={w.icon} alt="" className="h-4 w-4" />Pay with {w.name}</button>)}<a href={p.solana_pay_url} className="btn-ghost !h-10">Solana Pay link</a></div>
    <p className="mt-3 text-[12px] text-[var(--muted)]">Any wallet works: send exactly {p.amount_sol} SOL to the address. With the button or Solana Pay link the reference is attached and we detect it automatically. Otherwise paste the tx hash or Solscan link:</p>
    <div className="mt-2 flex gap-2"><input className="input mono flex-1" placeholder="tx signature or solscan.io/tx/…" value={tx} onChange={e => setTx(e.target.value.trim())} /><button className="btn-primary !h-10" disabled={!tx || busy} onClick={verify}>Verify</button></div>
    {msg && <p className="mt-2 text-[12.5px] text-[var(--fg-2)] break-all">{msg}</p>}<p className="mono mt-2 text-[11px] text-[var(--muted)]">order {p.order_id} · expires in {p.expires_in_min} min · devnet</p>
  </div>);
}
