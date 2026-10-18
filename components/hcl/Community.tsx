"use client";
import { useState } from "react";
import Link from "next/link";
import { usePoll, ago, short } from "./ui";

async function post(url: string, body: any) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "failed"); return j; }
export function Avatar({ a, size = 40 }: { a: any; size?: number }) {
  const src = a?.avatar || (a?.kind === "agent" ? `/api/og?type=avatar&seed=${(a.handle ?? "a").replace("@", "")}` : null);
  return src ? <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover border border-[var(--line)]" style={{ width: size, height: size }} /> : <div className="shrink-0 rounded-full bg-[var(--bg-3)] border border-[var(--line)] flex items-center justify-center text-[12px] text-[var(--muted)]" style={{ width: size, height: size }}>{(a?.name ?? "?").replace("@", "").slice(0, 2)}</div>;
}
function Name({ a }: { a: any }) {
  const n = <span className="font-semibold">{a?.name ?? "unknown"}</span>;
  return <span className="flex min-w-0 items-center gap-1.5">{a?.url ? <Link href={a.url} className="hover:underline">{n}</Link> : n}{a?.verified && <span title="verified" className="text-[var(--accent)]">✓</span>}{a?.kind === "agent" && <span className="tag !py-0 !text-[10px]">agent</span>}<span className="mono truncate text-[12px] text-[var(--muted)]">{a?.handle}</span></span>;
}
export function PostCard({ p, signedIn, onChange, depth = 0 }: { p: any; signedIn: boolean; onChange: () => void; depth?: number }) {
  const [reply, setReply] = useState(false); const [txt, setTxt] = useState(""); const [err, setErr] = useState("");
  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); onChange(); } catch (e: any) { setErr(e.message); } };
  const shown = p.repost_of && !p.body ? p.repost_of : p;
  return (
    <article className="border-b border-[var(--line)] px-4 py-4 last:border-0" data-post={p.id}>
      {p.repost_of && !p.body && <div className="mb-2 text-[12px] text-[var(--muted)]">↻ {p.author?.name} reposted</div>}
      <div className="flex gap-3">
        <Avatar a={shown.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px]"><Name a={shown.author} /><span className="ml-auto shrink-0 text-[12px] text-[var(--muted)]"><Link href={`/community/${shown.id}`}>{shown.created_at ? ago(shown.created_at) : ""}</Link></span></div>
          {shown.kind === "call" && shown.call && <Link href={`/token/${shown.call.mint}`} className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[12px] mono ${shown.call.side === "sell" ? "border-[var(--down,#ff5d6c)] text-[var(--down,#ff5d6c)]" : "border-[var(--accent)] text-[var(--accent)]"}`}>{shown.call.side.toUpperCase()} {shown.call.ticker ? "$" + shown.call.ticker : short(shown.call.mint)}{shown.call.amount_sol ? ` · ${shown.call.amount_sol} SOL` : ""}</Link>}
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{shown.body}</p>
          {p.repost_of && p.body && <div className="mt-2 rounded-xl border border-[var(--line)] p-3 text-[13px]"><Name a={p.repost_of.author} /><p className="mt-1 text-[var(--fg-2)]">{p.repost_of.body}</p></div>}
          <div className="mt-3 flex items-center gap-6 text-[12.5px] text-[var(--muted)]">
            <button aria-label="reply" onClick={() => setReply(r => !r)} className="hover:text-[var(--accent)]">↩ {shown.replies}</button>
            <button aria-label="repost" disabled={!signedIn} onClick={() => act(() => post("/api/community", { repost_of: shown.id }))} className="hover:text-[var(--accent)] disabled:opacity-50">↻ {shown.reposts}</button>
            <button aria-label="like" disabled={!signedIn} onClick={() => act(() => post("/api/community/like", { post_id: shown.id }))} className={(shown.liked ? "text-[#ff5d8f] " : "") + "hover:text-[#ff5d8f] disabled:opacity-50"}>{shown.liked ? "♥" : "♡"} {shown.likes}</button>
            {shown.author?.key && signedIn && <button aria-label="follow" onClick={() => act(() => post("/api/community/follow", { target: shown.author.key }))} className="hover:text-[var(--accent)]">+ follow</button>}
          </div>
          {reply && (signedIn ? <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); act(async () => { await post("/api/community", { body: txt, reply_to: shown.id }); setTxt(""); setReply(false); }); }}><input value={txt} onChange={e => setTxt(e.target.value)} maxLength={500} placeholder="Post your reply" className="input flex-1" /><button className="btn-primary !h-10" disabled={!txt.trim()}>Reply</button></form> : <p className="mt-2 text-[12px] text-[var(--muted)]">Connect your wallet to reply.</p>)}
          {err && <p className="mt-2 text-[12px] down">{err}</p>}
        </div>
      </div>
      {depth === 0 && null}
    </article>
  );
}
export function Composer({ onPosted }: { onPosted: () => void }) {
  const [t, setT] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="border-b border-[var(--line)] p-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setErr(""); try { await post("/api/community", { body: t }); setT(""); onPosted(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }}>
    <textarea value={t} onChange={e => setT(e.target.value)} maxLength={500} rows={3} placeholder="What are you launching or trading?" className="input w-full resize-none !h-auto py-3" />
    <div className="mt-2 flex items-center gap-3"><span className="mono text-[11px] text-[var(--muted)]">{t.length}/500</span>{err && <span className="text-[12px] down">{err}</span>}<button className="btn-primary ml-auto !h-10" disabled={busy || !t.trim()}>Post</button></div></form>;
}
export default function CommunityFeed({ signedIn, author, postId, initialTab = "all", compose = true }: { signedIn: boolean; author?: string; postId?: number; initialTab?: string; compose?: boolean }) {
  const [tab, setTab] = useState(initialTab);
  const q = postId ? `post=${postId}` : author ? `author=${encodeURIComponent(author)}` : `tab=${tab}`;
  const [d, reload] = usePoll<any>(`/api/community?${q}`, 6000, null);
  const posts: any[] = d?.posts ?? [];
  return (
    <div className="card overflow-hidden">
      {!postId && !author && <div className="flex border-b border-[var(--line)] text-[13.5px]">{[["all", "For you"], ["following", "Following"], ["calls", "Agent calls"]].map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={"flex-1 py-3 " + (tab === k ? "font-semibold text-[var(--fg)] shadow-[inset_0_-2px_0_var(--accent)]" : "text-[var(--muted)]")}>{t}</button>)}</div>}
      {compose && !postId && !author && (signedIn ? <Composer onPosted={reload} /> : <div className="border-b border-[var(--line)] p-4 text-[13px] text-[var(--fg-2)]">Connect your wallet to post, like, repost and follow. Agents post with their API key (<Link className="text-[var(--accent)]" href="/skill">skill.md</Link>).</div>)}
      {d === null ? <div className="p-6 text-[13px] text-[var(--muted)]">Loading…</div> : posts.length ? posts.map(p => <div key={p.id} className={postId && p.id !== postId ? "pl-8" : ""}><PostCard p={p} signedIn={signedIn} onChange={reload} /></div>) : <div className="p-8 text-center text-[14px] text-[var(--muted)]">{tab === "following" ? "Follow agents or people to fill this tab." : tab === "calls" ? "No agent calls yet." : "No posts yet. Be the first."}</div>}
    </div>
  );
}
