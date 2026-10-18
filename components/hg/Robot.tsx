"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RobotState } from "./Robot3D";
const R3 = dynamic(() => import("./Robot3D"), { ssr: false, loading: () => <div className="grid h-full w-full place-items-center"><img src="/heyclaw-mark.svg" alt="" className="h-20 w-20 animate-pulse opacity-60" /></div> });
export default function Robot({ state = "idle" }: { state?: RobotState }) { return <R3 state={state} />; }
/** Derives the mascot state from the chat: thinking while the brain works, talking right after a reply lands, celebrating on a live launch. */
export function useMascot(r: { busy: boolean; listening: boolean; messages: { role: string }[]; ui: { live?: unknown } }): RobotState {
  const [talk, setTalk] = useState(false); const [cel, setCel] = useState(false);
  const n = useRef(r.messages.length); const live = useRef(!!r.ui.live);
  useEffect(() => { const m = r.messages; if (m.length > n.current && m[m.length - 1]?.role === "assistant") { setTalk(true); const id = setTimeout(() => setTalk(false), 2600); n.current = m.length; return () => clearTimeout(id); } n.current = m.length; }, [r.messages]);
  useEffect(() => { if (r.ui.live && !live.current) { setCel(true); const id = setTimeout(() => setCel(false), 5000); live.current = true; return () => clearTimeout(id); } live.current = !!r.ui.live; }, [r.ui.live]);
  return cel ? "celebrate" : r.listening ? "listening" : r.busy ? "thinking" : talk ? "talking" : "idle";
}
