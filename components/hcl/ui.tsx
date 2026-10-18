"use client";
import { useEffect, useState } from "react";
export const ipfsImg = (cid?: string | null) => cid ? `https://ipfs.io/ipfs/${cid}` : undefined;
export const short = (s?: string | null, n = 4) => s ? `${s.slice(0, n)}…${s.slice(-n)}` : "";
export const sol = (n: number, d = 4) => `${(+n).toFixed(d).replace(/0+$/, "").replace(/\.$/, "")} SOL`;
export const solscan = (sig: string, kind = "tx") => `https://solscan.io/${kind}/${sig}?cluster=devnet`;
export function ago(ts: string | number) { const s = Math.max(0, (Date.now() - +new Date(ts)) / 1000); return s < 60 ? `${s | 0}s` : s < 3600 ? `${(s / 60) | 0}m` : s < 86400 ? `${(s / 3600) | 0}h` : `${(s / 86400) | 0}d`; }
export function usePoll<T>(url: string, ms: number, init: T): [T, () => void] {
  const [d, setD] = useState<T>(init); const [k, setK] = useState(0);
  useEffect(() => { let on = true; const go = () => fetch(url, { cache: "no-store" }).then(r => r.json()).then(j => on && setD(j)).catch(() => {}); go(); const id = setInterval(go, ms); return () => { on = false; clearInterval(id); }; }, [url, ms, k]);
  return [d, () => setK(x => x + 1)];
}
export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, (+new Date(to) - now) / 1000); const d = (s / 86400) | 0, h = ((s % 86400) / 3600) | 0, m = ((s % 3600) / 60) | 0, x = (s % 60) | 0;
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="mono tabular-nums">{d ? `${d}d ` : ""}{p(h)}:{p(m)}:{p(x)}</span>;
}
export function PageHead({ eyebrow, title, sub, art }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; art?: string }) {
  return <section className="relative overflow-hidden"><div className="wrap grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_380px]"><div><div className="eyebrow rise"><span className="live-dot"></span>{eyebrow}</div><h1 className="h1 rise rise-1 mt-5 !text-[clamp(38px,6vw,68px)]">{title}</h1>{sub && <p className="rise rise-2 mt-5 max-w-[600px] text-[16px] leading-relaxed text-[var(--fg-2)]">{sub}</p>}</div>{art && <div className="rise rise-2 relative hidden aspect-square overflow-hidden rounded-[28px] border border-[var(--line)] lg:block"><img src={art} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" /></div>}</div></section>;
}
