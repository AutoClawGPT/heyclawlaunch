"use client";
import { useState } from "react";
export default function CopyBtn({ v }: { v: string }) { const [ok, setOk] = useState(false); return <button type="button" onClick={() => { navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1200); }} className="btn-ghost shrink-0  !h-7 !px-2.5 !text-[11px]">{ok ? "Copied" : "Copy"}</button>; }
