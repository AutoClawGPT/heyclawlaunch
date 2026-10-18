"use client";
import { useEffect, useRef, useState } from "react";
export type Msg = { role: "user" | "assistant"; content: string };
export type Pending = { id: string; summary: string } | null;
export type UI = { card?: { name?: string; ticker?: string; logo?: string; fees?: string; pair?: string }; ready?: boolean; live?: { mint: string; pageUrl: string; pumpUrl: string } };
export function useRobot() {
  const [messages, setMessages] = useState<Msg[]>([]); const [draftId, setDraftId] = useState<string | null>(null);
  const [ui, setUi] = useState<UI>({}); const [pending, setPending] = useState<Pending>(null); const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false); const [voice, setVoice] = useState(false); const rec = useRef<any>(null);
  useEffect(() => { const s = sessionStorage.getItem("hg_robot"); if (s) { const j = JSON.parse(s); setMessages(j.messages ?? []); setDraftId(j.draftId ?? null); setUi(j.ui ?? {}); } }, []);
  useEffect(() => { sessionStorage.setItem("hg_robot", JSON.stringify({ messages, draftId, ui })); }, [messages, draftId, ui]);
  function speak(t: string) { if (!voice || typeof speechSynthesis === "undefined") return; speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t.replace(/https?:\/\/\S+/g, "the link").slice(0, 400))); }
  async function send(text: string, confirmActionId?: string) {
    const next = text ? [...messages, { role: "user" as const, content: text }] : messages;
    setMessages(next); setBusy(true); setPending(null);
    try {
      const r = await fetch("/api/robot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, draftId, confirmed: !!confirmActionId, confirmActionId }) }).then(r => r.json());
      const reply = r.reply ?? r.error ?? "…"; setMessages([...next, { role: "assistant", content: reply }]); speak(reply);
      if (r.draftId !== undefined) setDraftId(r.draftId); if (r.ui) setUi(r.ui); setPending(r.pending ?? null);
    } catch (e: any) { setMessages([...next, { role: "assistant", content: "Network error, try again." }]); } finally { setBusy(false); }
  }
  const [gen, setGen] = useState<string | null>(null);
  async function genCall(label: string, init: RequestInit) {
    setGen(label); setPending(null);
    try {
      const r = await fetch("/api/gen", { method: "POST", ...init }).then(r => r.json());
      if (r.error) { setMessages(m => [...m, { role: "assistant", content: r.error }]); return; }
      if (r.draftId) setDraftId(r.draftId); if (r.ui) setUi(r.ui); if (r.pending) setPending(r.pending);
      setMessages(m => [...m, { role: "assistant", content: r.reply }]);
    } catch { setMessages(m => [...m, { role: "assistant", content: "Generation failed, try again." }]); } finally { setGen(null); }
  }
  const genLogo = (prompt?: string, label = "Generating logo…") => genCall(label, { headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logo", draftId, prompt }) });
  const genIdea = (theme?: string) => genCall("Inventing your coin…", { headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "idea", theme }) });
  const upload = (file: File) => { const fd = new FormData(); fd.append("file", file); if (draftId) fd.append("draftId", draftId); return genCall("Uploading…", { body: fd }); };
  function reset() { setMessages([]); setDraftId(null); setUi({}); setPending(null); }
  function call(): boolean {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition; if (!SR) return false;
    if (listening) { rec.current?.stop(); return true; }
    setVoice(true); const r = new SR(); r.lang = "en-US"; r.interimResults = false; rec.current = r;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; if (t) send(t); }; r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.start(); setListening(true); return true;
  }
  return { messages, ui, pending, busy: busy || !!gen, gen, listening, send, reset, call, setPending, genLogo, genIdea, upload, draftId };
}
