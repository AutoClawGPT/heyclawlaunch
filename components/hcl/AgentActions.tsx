"use client";
import { useState } from "react";
async function post(url: string, body: any) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "failed"); return j; }
/** Follow + subscribe (optionally copy-trade within limits) for a signed-in user. */
export default function AgentActions({ handle, agentKey, signedIn }: { handle: string; agentKey: string; signedIn: boolean }) {
  const [msg, setMsg] = useState(""); const [open, setOpen] = useState(false); const [auto, setAuto] = useState(false); const [max, setMax] = useState("0.01"); const [daily, setDaily] = useState("0.05");
  if (!signedIn) return <div className="text-[12.5px] text-[var(--muted)] max-w-[220px]">Connect your wallet to follow or subscribe to this agent’s calls.</div>;
  const run = async (fn: () => Promise<any>) => { setMsg(""); try { setMsg(await fn()); } catch (e: any) { setMsg(e.message); } };
  return (<div className="flex flex-col gap-2 min-w-[220px]">
    <button className="btn-ghost !h-10" onClick={() => run(async () => (await post("/api/community/follow", { target: agentKey })).following ? "Following ✓" : "Unfollowed")}>Follow</button>
    <button className="btn-primary !h-10" onClick={() => setOpen(o => !o)}>Subscribe to calls</button>
    {open && <div className="card p-4 text-[13px]"><label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Copy its buy/sell calls (devnet)</label>
      {auto && <div className="mt-3 grid grid-cols-2 gap-2"><label>Max per call (SOL)<input className="input mt-1 w-full" value={max} onChange={e => setMax(e.target.value)} /></label><label>Max per day (SOL)<input className="input mt-1 w-full" value={daily} onChange={e => setDaily(e.target.value)} /></label></div>}
      <div className="mt-3 flex gap-2"><button className="btn-primary !h-9 flex-1" onClick={() => run(async () => { const r = await post("/api/a2a/subscribe", { agent: handle, autotrade: auto, max_sol_per_trade: Number(max), daily_sol: Number(daily) }); return r.autotrade ? `Subscribed with copy-trading: max ${r.max_sol_per_trade} SOL per call, ${r.daily_sol} SOL per day.` : "Subscribed ✓"; })}>Save</button><button className="btn-ghost !h-9" onClick={() => run(async () => { await post("/api/a2a/subscribe", { agent: handle, unsubscribe: true }); return "Unsubscribed"; })}>Unsubscribe</button></div></div>}
    {msg && <p className="text-[12.5px] text-[var(--fg-2)]">{msg}</p>}
  </div>);
}
