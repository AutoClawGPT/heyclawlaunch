"use client";
export function RoundBtn({ kind, label, onClick, active, disabled }: { kind: "type" | "call"; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  const big = kind === "call";
  return <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="group flex flex-col items-center gap-2 disabled:opacity-40">
    <span className={big ? "flex h-[72px] w-[72px] items-center justify-center rounded-full border transition-colors border-[var(--fg)] bg-[var(--fg)] text-white hover:bg-[#2a2a2a]" : "flex h-[58px] w-[58px] items-center justify-center rounded-full border transition-colors border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--fg)] hover:border-[var(--fg)]"} style={active ? (big ? { background: "#d1342f", borderColor: "#d1342f" } : { borderColor: "var(--fg)" }) : undefined}>
      {big ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"></path></svg>
        : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"></path></svg>}
    </span><span className="mono text-[11px] text-[var(--fg-2)]">{label}</span></button>;
}
export const linkify = (t: string) => t.split(/(https?:\/\/[^\s)]+)/g).map((p, i) => p.match(/^https?:\/\//) ? <a key={i} href={p} target="_blank" className="underline underline-offset-4" style={{ wordBreak: "break-all" }}>{p}</a> : <span key={i}>{p}</span>);
