"use client";
import { useEffect, useRef, useState } from "react";
import { useRobot } from "./useRobot";
import { RoundBtn, linkify } from "./Buttons";
import Robot, { useMascot } from "./Robot";
import LogoActions from "./LogoActions";
function Bubbles({ r }: { r: ReturnType<typeof useRobot> }) {
  return <>{r.messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-auto" : ""} style={{ maxWidth: "85%", whiteSpace: "pre-wrap", borderRadius: 18, padding: "10px 14px", fontSize: 14.5, lineHeight: 1.5, background: m.role === "user" ? "var(--fg)" : "var(--bg-3)", color: m.role === "user" ? "var(--bg)" : "var(--fg)" }}>{linkify(m.content)}</div>)}
    {r.busy && <div className="mono text-[12px] text-[var(--muted)]">Claw is thinking…</div>}
    {r.pending && <div className="rounded-[22px] border border-[var(--line)] bg-[var(--bg-2)] p-4 text-[14px]"><div className="mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">Confirm</div><p className="mt-2 text-[var(--fg-2)]" style={{ whiteSpace: "pre-wrap" }}>{r.pending.summary}</p><div className="mt-3 flex gap-2"><button className="btn-primary !h-9" onClick={() => r.send("", r.pending!.id)}>Confirm</button><button className="btn-ghost !h-9" onClick={() => r.setPending(null)}>Cancel</button></div></div>}</>;
}
function Composer({ r, inputRef }: { r: ReturnType<typeof useRobot>; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [t, setT] = useState("");
  return <form className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--line-2)] p-2 sm:flex-row" onSubmit={e => { e.preventDefault(); if (t.trim() && !r.busy) { r.send(t.trim()); setT(""); } }}>
    <input ref={inputRef} value={t} onChange={e => setT(e.target.value)} placeholder="Say “launch a coin”…" className="mono flex min-h-[44px] min-w-0 flex-1 items-center bg-transparent px-3 text-[14px] outline-none placeholder:text-[var(--muted)]" />
    <button className="btn-primary shrink-0" disabled={r.busy}>Send</button></form>;
}
export default function CallScreen() {
  const r = useRobot(); const mascot = useMascot(r); const [typing, setTyping] = useState(false); const end = useRef<HTMLDivElement>(null); const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [r.messages, r.busy, r.pending]);
  useEffect(() => { if (r.messages.length) setTyping(true); }, [r.messages.length]);
  const c = r.ui.card ?? {}; const status = r.listening ? "LISTENING…" : r.busy ? "THINKING…" : r.ui.live ? "YOUR COIN IS LIVE" : r.messages.length ? "IN CALL" : "READY WHEN YOU ARE";
  const dim = (v?: string) => v ? "" : " text-[var(--muted)]";
  return (
    <main className="wrap py-6"><h1 className="sr-only">Call Claw to launch a coin</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:h-[calc(100svh-var(--nav-h)-48px)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <section className="flex min-h-0 flex-col items-center justify-center">
          <div className="relative h-[380px] w-full shrink sm:h-[460px] lg:h-[min(64vh,580px)]"><div className="absolute inset-0" aria-hidden="true"><Robot state={mascot} /></div></div>
          <div className="mono inline-flex h-[44px] items-center gap-3 rounded-[12px] border px-5 text-[14px] border-[var(--line)] bg-[var(--bg-2)]"><span className="flex h-4 items-center gap-[3px]">{[6, 10, 14, 8].map((h, i) => <span key={i} className="block w-[3px] rounded-full bg-current" style={{ height: r.listening || r.busy ? h : 6 }}></span>)}</span>{status}</div>
          <div className="mono mt-3 h-5 text-[12px] text-[var(--muted)]">{r.messages.length ? <button onClick={() => { r.reset(); setTyping(false); }} className="underline underline-offset-4">start over</button> : ""}</div>
          <div className="mt-6"><div className="flex items-end justify-center gap-7"><RoundBtn kind="type" label="Type" active={typing} onClick={() => { setTyping(true); setTimeout(() => inp.current?.focus(), 30); }} /><RoundBtn kind="call" label={r.listening ? "Listening" : "Call Claw"} active={r.listening} onClick={() => { if (!r.call()) { setTyping(true); setTimeout(() => inp.current?.focus(), 30); } }} /><span className="w-[58px]"></span></div></div>
        </section>
        <section className="flex min-h-0 flex-col gap-5">
          <div className="relative flex min-h-[260px] flex-1 flex-col lg:min-h-0"><div className="flex max-h-[52vh] min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2 pr-1 pt-8 [mask-image:linear-gradient(to_bottom,transparent,#000_48px)] lg:max-h-none">
            {!r.messages.length && <div className="m-auto max-w-[360px] text-center"><div className="display text-[26px] font-bold leading-tight tracking-[-0.03em]">Hey Claw, <span className="text-[var(--muted)]">launch a coin.</span></div><p className="mt-3 text-[14.5px] leading-relaxed text-[var(--fg-2)]">Tap call and talk, or type. Claw asks for the name, ticker, logo and fees, then launches it on pump.fun.</p></div>}
            <Bubbles r={r} /><div ref={end} /></div></div>
          {typing && <Composer r={r} inputRef={inp} />}
          <div className="shrink-0"><div className="rounded-[22px] border border-[var(--line)] bg-[var(--bg-2)] p-5"><div className="mono flex items-center justify-between text-[12px] uppercase tracking-[0.06em]"><span className="text-[var(--muted)]">Your coin</span><span className="flex items-center gap-4 normal-case tracking-normal text-[var(--muted)]">{r.ui.live ? <span className="up">live on pump.fun</span> : "no dev buy · 0 SOL"}</span></div>
            <div className="mt-4 grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="flex min-w-0 items-center gap-5"><div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[var(--bg-3)]">{c.logo ? <img src={c.logo} alt="" style={{ width: 72, height: 72, objectFit: "cover" }} /> : <span className="mono text-[12px] text-[var(--muted)]">logo</span>}</div><div className="min-w-0"><div className={"display truncate text-[30px] font-bold leading-none tracking-[-0.04em]" + dim(c.name)}>{c.name ?? "…"}</div><div className={"mono mt-2 text-[16px]" + dim(c.ticker)}>${c.ticker ?? "…"}</div></div></div>
              {r.ui.live ? <div className="flex flex-wrap gap-2"><a className="btn-primary" href={r.ui.live.pageUrl}>Coin page</a><a className="btn-ghost" target="_blank" href={r.ui.live.pumpUrl}>pump.fun ↗</a></div> : r.ui.ready ? <button className="btn-primary btn-big" disabled={r.busy} onClick={() => r.send("Yes, launch it.")}>Launch it</button> : null}</div>
            <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-1.5 text-[15px]"><dt className="text-[var(--muted)]">Fees</dt><dd className={"truncate font-semibold" + dim(c.fees)}>{c.fees ?? "…"}</dd><dt className="text-[var(--muted)]">Pair</dt><dd className={"font-semibold" + dim(c.pair)}>{c.pair ?? "…"}</dd></dl>{!r.ui.live && <div className="mt-4 border-t border-[var(--line)] pt-4"><LogoActions r={r} /></div>}</div></div>
        </section>
      </div>
      <p className="mono mt-10 border-t border-[var(--line)] pt-5 text-[11.5px] text-[var(--muted)]">Launches are permanent and free: HeyClawLaunch pays the SOL, never a dev buy. Independent project, not affiliated with xAI. Not financial advice.</p>
    </main>);
}
export function RobotCard() {
  const r = useRobot(); const mascot = useMascot(r); const [typing, setTyping] = useState(false); const inp = useRef<HTMLInputElement>(null);
  const last = [...r.messages].reverse().find(m => m.role === "assistant");
  return (
    <div className="rise rise-2 card p-4 sm:p-5"><div className="flex flex-col gap-4"><div className="card relative flex flex-col items-center overflow-hidden px-5 pb-6 pt-5 sm:px-8">
      <div className="mono flex w-full items-center justify-between text-[11.5px] text-[var(--muted)]"><span className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--muted)]"></span>HEYCLAW</span><span>voice · en</span></div>
      <div className="relative mt-2 w-full h-[260px] sm:h-[300px]"><div className="absolute inset-0" aria-hidden="true"><Robot state={mascot} /></div></div>
      <div className="display text-[28px] font-bold leading-none tracking-[-0.03em]">Claw</div><div className="mono mt-2 text-[12px] text-[var(--fg-2)]">Launch assistant · voice</div>
      {r.ui.card?.name && <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-[var(--line)] p-2 pr-4">{r.ui.card.logo ? <img src={r.ui.card.logo} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10 }} /> : <span className="bg-[var(--bg-3)]" style={{ width: 44, height: 44, borderRadius: 10, display: "inline-block" }} />}<div className="min-w-0 text-left"><div className="display truncate text-[17px] font-bold">{r.ui.card.name}</div><div className="mono text-[12px] text-[var(--muted)]">{r.ui.card.ticker ? "$" + r.ui.card.ticker : ""}</div></div>{r.ui.ready && !r.ui.live && <button className="btn-primary !h-9 ml-3" disabled={r.busy} onClick={() => r.send("Yes, launch it.")}>Launch it</button>}{r.ui.live && <a className="btn-primary !h-9 ml-3" href={r.ui.live.pageUrl}>Coin page</a>}</div>}
      <div className="mt-5 min-h-[84px] w-full max-w-[520px] text-center"><p className="text-[15px] leading-relaxed text-[var(--fg-2)]" style={{ whiteSpace: "pre-wrap" }}>{r.gen ? r.gen : r.busy ? "…" : last ? linkify(last.content) : "Call Claw and tell it the name, ticker and logo. Your coin goes live on pump.fun. No wallet, no SOL, no dev buy."}</p>
        {r.pending && <div className="mt-3 flex justify-center gap-2"><button className="btn-primary !h-9" onClick={() => r.send("", r.pending!.id)}>Confirm</button><button className="btn-ghost !h-9" onClick={() => r.setPending(null)}>Cancel</button></div>}</div>
      {typing && <form className="mt-4 flex w-full gap-2 rounded-[var(--radius)] border border-[var(--line-2)] p-1.5" onSubmit={e => { e.preventDefault(); const v = inp.current!.value.trim(); if (v && !r.busy) { r.send(v); inp.current!.value = ""; } }}><input ref={inp} placeholder="Say “launch a coin”…" className="mono min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none placeholder:text-[var(--muted)]" /><button className="btn-primary !h-9">Send</button></form>}
      {(typing || r.messages.length > 0) && <div className="mt-4 flex w-full justify-center"><LogoActions r={r} compact /></div>}<div className="mt-3 flex justify-center"><button type="button" className="btn-accent !h-9 !text-[12.5px]" disabled={r.busy} onClick={() => { setTyping(true); r.genIdea(); }}>✦ Generate everything</button></div>
      <div className="mt-6 flex items-end justify-center gap-6 sm:gap-8"><RoundBtn kind="type" label="Type" active={typing} onClick={() => { setTyping(true); setTimeout(() => inp.current?.focus(), 30); }} /><RoundBtn kind="call" label={r.listening ? "Listening" : "Call Claw"} active={r.listening} onClick={() => { if (!r.call()) location.href = "/launch"; }} /><span className="w-[58px]"></span></div>
    </div><a className="text-center text-[12.5px] font-medium underline underline-offset-4" href="/launch">Open the full call screen →</a></div></div>);
}
