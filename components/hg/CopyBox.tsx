"use client";
import { useState } from "react";
export default function CopyBox({ value, className = "", label = "Copy the link" }: { value: string; className?: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <div className={`flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--line-2)] p-2 sm:flex-row ${className}`}><code className="mono flex min-h-[48px] min-w-0 flex-1 items-center justify-center truncate px-3 text-[14px] sm:justify-start">{value}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }} className="btn-primary shrink-0  btn-big w-full sm:w-auto">{ok ? "Copied ✓" : label}</button></div>;
}
