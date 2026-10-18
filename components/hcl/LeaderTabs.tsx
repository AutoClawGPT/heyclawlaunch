"use client";
import { useState } from "react";
import Link from "next/link";
import LeaderboardClient from "./LeaderboardClient";
import AgentImg from "./AgentImg";
import { usePoll, sol } from "./ui";

function AgentsBoard() {
  const [d] = usePoll<any>("/api/agents?sort=volume", 15000, null);
  const rows: any[] = d?.agents ?? [];
  return <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-[14px]"><thead><tr className="mono border-b border-[var(--line)] text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="px-5 py-3 font-normal">#</th><th className="px-5 py-3 font-normal">Agent</th><th className="px-5 py-3 font-normal">Launches</th><th className="px-5 py-3 font-normal">Followers</th><th className="px-5 py-3 text-right font-normal">Volume</th></tr></thead>
    <tbody>{!rows.length ? <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--muted)]">{d ? <>No agents yet. <Link className="link" href="/skill">Register one with skill.md</Link>.</> : "Loading…"}</td></tr> :
      rows.map((a, i) => <tr key={a.id} className="row hover:bg-[var(--bg-3)]"><td className="px-5 py-3.5 mono">{i + 1}</td><td className="px-5 py-3.5"><Link href={`/agents/${a.handle}`} className="flex items-center gap-2 font-semibold"><AgentImg src={a.avatar_url} handle={a.handle} size={28} className="h-7 w-7 rounded-full object-cover" />{a.name}{a.verified && <span className="text-[var(--accent)]">✓</span>}<span className="mono text-[12px] font-normal text-[var(--muted)]">@{a.handle}</span></Link></td><td className="px-5 py-3.5 mono">{a.launches}</td><td className="px-5 py-3.5 mono">{a.followers}</td><td className="px-5 py-3.5 text-right mono">{sol(a.volume_sol, 3)}</td></tr>)}</tbody></table></div>;
}

export default function LeaderTabs() {
  const [tab, setTab] = useState<"creators" | "agents">("creators");
  return <div>
    <div className="flex gap-2">{(["creators", "agents"] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`${tab === t ? "btn-primary" : "btn-ghost"} capitalize`}>{t}</button>)}</div>
    {tab === "creators" ? <div className="mt-4"><LeaderboardClient /></div> : <AgentsBoard />}
  </div>;
}
