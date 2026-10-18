"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SignIn from "@/components/SignIn";
type T = { id: string; name: string; ticker: string; description: string | null; logo_url?: string; pair: string; theme: string | null };
export default function TemplatesClient({ templates, signedIn }: { templates: T[]; signedIn: boolean }) {
  const [sel, setSel] = useState<T | null>(null); const [draft, setDraft] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [live, setLive] = useState<any>(null);
  async function call(body: any) { setBusy(true); setErr(""); try { const r = await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; } catch (e: any) { setErr(e.message); return null; } finally { setBusy(false); } }
  async function pick(t: T) { setSel(t); setDraft(null); setLive(null); setErr(""); if (!signedIn) return; const j = await call({ action: "draft", id: t.id }); if (j) setDraft(j); }
  async function confirm() { const j = await call({ action: "confirm", draft_id: draft.draft_id, user_confirmed: true }); if (j) setLive(j); }
  return <>
    {!templates.length && <div className="card p-8 text-[var(--fg-2)]">No templates yet.</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((t, i) => <motion.button key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => pick(t)} className="card spot group overflow-hidden text-left">
        <div className="relative aspect-square overflow-hidden bg-[var(--bg-3)]">{t.logo_url && <img src={t.logo_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}<span className="tag absolute left-3 top-3 !bg-[var(--bg)]/70 backdrop-blur">{t.pair} pair</span></div>
        <div className="p-4"><div className="flex items-baseline justify-between gap-2"><div className="display truncate text-[17px] font-semibold">{t.name}</div><div className="mono text-[12px] text-[var(--accent)]">${t.ticker}</div></div><p className="mt-2 line-clamp-2 text-[13px] text-[var(--fg-2)]">{t.description}</p><div className="btn-accent mt-4 w-full !py-2 !text-[13px]">Launch this</div></div>
      </motion.button>)}
    </div>
    <AnimatePresence>{sel && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !busy && setSel(null)}>
      <motion.div initial={{ y: 30, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} onClick={e => e.stopPropagation()} className="card w-full max-w-[520px] overflow-hidden" role="dialog" aria-modal="true" aria-label={`Launch ${sel.name}`}>
        <div className="flex gap-4 p-5"><img src={sel.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" /><div className="min-w-0"><div className="eyebrow">Template preview</div><div className="display mt-1 text-[24px] font-bold">{sel.name}</div><div className="mono text-[13px] text-[var(--accent)]">${sel.ticker} · {sel.pair}</div></div></div>
        <div className="border-t border-[var(--line)] p-5">
          {!signedIn ? <><p className="mb-4 text-[14px] text-[var(--fg-2)]">Sign in to launch: it launches from your own HeyClawLaunch wallet and the 80% creator fees go to it.</p><SignIn xEnabled={false} returnTo="/templates" /></>
            : live ? <div className="space-y-3"><div className="display text-[22px] font-bold up">It’s live 🎉</div><p className="text-[14px] text-[var(--fg-2)] whitespace-pre-wrap">{live.text}</p><div className="flex gap-2"><a className="btn-accent" href={live.pageUrl}>Coin page</a><a className="btn-ghost" target="_blank" rel="noreferrer" href={live.pumpUrl}>pump.fun ↗</a></div></div>
            : draft ? <><pre className="mono whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-4 text-[12.5px] leading-relaxed text-[var(--fg-2)]">{draft.summary}</pre><p className="mt-3 text-[12.5px] text-[var(--muted)]">Fees (80%) → your wallet <span className="mono">{draft.wallet}</span>. 20% platform. No dev buy, HeyClawLaunch pays the SOL. Launches are permanent.</p><div className="mt-4 flex gap-2"><button className="btn-accent btn-big flex-1" disabled={busy} onClick={confirm}>{busy ? "Launching…" : "Confirm launch"}</button><button className="btn-ghost btn-big" disabled={busy} onClick={() => setSel(null)}>Cancel</button></div></>
            : <p className="text-[14px] text-[var(--fg-2)]">{busy ? "Preparing your draft…" : ""}</p>}
          {err && <p className="down mt-3 text-[13px]">{err}</p>}
        </div>
      </motion.div></motion.div>}</AnimatePresence>
  </>;
}
