"use client";
import { useRef, useState } from "react";
import type { useRobot } from "./useRobot";
type R = ReturnType<typeof useRobot>;
const chip = "btn-ghost !h-9 !px-3 !text-[12.5px]";
/** Upload / Generate / Regenerate logo + "Generate everything" (fills the coin card; launching still needs Confirm). */
export default function LogoActions({ r, compact = false }: { r: R; compact?: boolean }) {
  const file = useRef<HTMLInputElement>(null); const [theme, setTheme] = useState(""); const [p, setP] = useState(""); const [ask, setAsk] = useState(false);
  const hasLogo = !!r.ui.card?.logo, dis = r.busy || !!r.ui.live;
  return (
    <div className="flex flex-col gap-2" data-testid="logo-actions">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={file} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) r.upload(f); e.target.value = ""; }} />
        <button type="button" className={chip} disabled={dis} onClick={() => file.current?.click()}>Upload image</button>
        <button type="button" className={chip} disabled={dis} onClick={() => setAsk(a => !a)}>Generate with AI</button>
        {hasLogo && <button type="button" className={chip} disabled={dis} onClick={() => r.genLogo(p || undefined, "Regenerating…")}>Regenerate</button>}
        {r.gen && <span className="mono text-[12px] text-[var(--muted)]">{r.gen}</span>}
      </div>
      {ask && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setAsk(false); r.genLogo(p.trim() || undefined); }}><input value={p} onChange={e => setP(e.target.value)} placeholder="Describe the logo (or leave empty to use the coin name)" className="mono min-w-0 flex-1 rounded-[10px] border border-[var(--line-2)] bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--muted)]" style={{ height: 36 }} /><button className="btn-primary !h-9">Generate</button></form>}
      {!compact && <form className="flex gap-2 border-t border-[var(--line)] pt-3" onSubmit={e => { e.preventDefault(); r.genIdea(theme.trim() || undefined); }}><input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Optional theme, e.g. frogs on mars" className="mono min-w-0 flex-1 rounded-[10px] border border-[var(--line-2)] bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--muted)]" style={{ height: 36 }} /><button className="btn-accent !h-9" disabled={dis}>✦ Generate everything</button></form>}
    </div>);
}
