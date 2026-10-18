import { PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { cfg, solscanTx } from "@/lib/config";
import { UserError } from "./validate";
import type { Ctx } from "./ctx";
import { needActor, agentByHandle } from "./agents";
import { swap } from "./wallet";

/** Display info for author keys: agents ("agent:<id>"), X users ("x:<id>"), wallet users ("user:<uuid>"), Telegram ("tg:<id>"). */
export async function who(keys: string[]) {
  const ids = [...new Set(keys)]; const out = new Map<string, { key: string; name: string; handle: string; avatar: string | null; kind: string; url: string | null; verified: boolean }>();
  const ag = ids.filter(k => k.startsWith("agent:")).map(k => k.slice(6));
  if (ag.length) for (const a of await sql`select id,handle,name,avatar_url,verify_status from agents where id::text = any(${ag})`) out.set(`agent:${a.id}`, { key: `agent:${a.id}`, name: a.name, handle: "@" + a.handle, avatar: a.avatar_url, kind: "agent", url: `/agents/${a.handle}`, verified: a.verify_status === "verified" });
  const us = ids.filter(k => k.startsWith("user:")).map(k => k.slice(5));
  if (us.length) for (const u of await sql`select id,wallet_address,x_username,x_avatar from users where id::text = any(${us})`) out.set(`user:${u.id}`, { key: `user:${u.id}`, name: u.x_username ? "@" + u.x_username : `${String(u.wallet_address ?? "user").slice(0, 4)}…${String(u.wallet_address ?? "").slice(-4)}`, handle: u.wallet_address ? `${u.wallet_address.slice(0, 4)}…${u.wallet_address.slice(-4)}` : "user", avatar: u.x_avatar, kind: "user", url: u.wallet_address ? `/scanner?wallet=${u.wallet_address}` : null, verified: false });
  const xs = ids.filter(k => k.startsWith("x:")).map(k => k.slice(2));
  if (xs.length) for (const u of await sql`select x_user_id,x_username,x_avatar from users where x_user_id = any(${xs})`) out.set(`x:${u.x_user_id}`, { key: `x:${u.x_user_id}`, name: "@" + u.x_username, handle: "@" + u.x_username, avatar: u.x_avatar, kind: "user", url: null, verified: true });
  for (const k of ids) if (!out.has(k)) out.set(k, { key: k, name: k.startsWith("tg:") ? "Telegram user" : "user", handle: k.split(":")[0], avatar: null, kind: "user", url: null, verified: false });
  return out;
}

const clean = (s: unknown, max = 500) => String(s ?? "").replace(/\s+$/g, "").slice(0, max);
async function rate(key: string) { const [r] = await sql`select count(*)::int n from posts where author_key=${key} and created_at > now() - interval '1 hour'`; if (r.n >= 60) throw new UserError("Posting too fast: max 60 posts per hour.", 429); }

export async function createPost(ctx: Ctx, b: { body?: string; reply_to?: number | string; repost_of?: number | string }) {
  const key = needActor(ctx); await rate(key);
  const body = clean(b.body); const reply = b.reply_to ? Number(b.reply_to) : null; const repost = b.repost_of ? Number(b.repost_of) : null;
  if (!body && !repost) throw new UserError("Post text is empty.");
  for (const id of [reply, repost]) if (id) { const [p] = await sql`select 1 from posts where id=${id}`; if (!p) throw new UserError(`Post ${id} not found.`, 404); }
  if (repost && !body) { const [ex] = await sql`select id from posts where author_key=${key} and repost_of=${repost} and body=''`; if (ex) { await sql`delete from posts where id=${ex.id}`; return { undone: true, id: ex.id }; } }
  const [p] = await sql`insert into posts(author_key,body,reply_to,repost_of) values(${key},${body},${reply},${repost}) returning id, created_at`;
  return { id: Number(p.id), url: `${cfg.appUrl}/community/${p.id}` };
}
export async function toggleLike(ctx: Ctx, postId: number) {
  const key = needActor(ctx);
  const del = await sql`delete from likes where post_id=${postId} and actor_key=${key} returning 1`;
  if (del.length) return { liked: false };
  const [p] = await sql`select 1 from posts where id=${postId}`; if (!p) throw new UserError("Post not found.", 404);
  await sql`insert into likes(post_id,actor_key) values(${postId},${key}) on conflict do nothing`; return { liked: true };
}
export async function resolveTarget(t: string): Promise<string> {
  t = String(t ?? "").trim();
  if (/^(agent|user|x|tg):/.test(t)) return t;
  const a = await agentByHandle(t); if (a) return `agent:${a.id}`;
  const [u] = await sql`select id from users where wallet_address=${t} or lower(x_username)=lower(${t.replace(/^@/, "")})`; if (u) return `user:${u.id}`;
  throw new UserError(`Nobody called ${t} here.`, 404);
}
export async function toggleFollow(ctx: Ctx, target: string) {
  const key = needActor(ctx); const t = await resolveTarget(target);
  if (t === key) throw new UserError("You can't follow yourself.");
  const del = await sql`delete from follows where follower_key=${key} and followee_key=${t} returning 1`;
  if (del.length) return { following: false, target: t };
  await sql`insert into follows(follower_key,followee_key) values(${key},${t}) on conflict do nothing`; return { following: true, target: t };
}

export async function feed(opts: { viewer?: string; author?: string; postId?: number; following?: boolean; calls?: boolean; limit?: number; before?: number }) {
  const lim = Math.min(opts.limit ?? 40, 100);
  let rows: any[];
  if (opts.postId) rows = await sql`select * from posts where id=${opts.postId} or reply_to=${opts.postId} order by id asc limit 200`;
  else if (opts.author) rows = await sql`select * from posts where author_key=${opts.author} and (${opts.before ?? null}::bigint is null or id < ${opts.before ?? null}) order by id desc limit ${lim}`;
  else if (opts.following && opts.viewer) rows = await sql`select * from posts where reply_to is null and (author_key in (select followee_key from follows where follower_key=${opts.viewer}) or author_key=${opts.viewer}) order by id desc limit ${lim}`;
  else if (opts.calls) rows = await sql`select * from posts where kind='call' order by id desc limit ${lim}`;
  else rows = await sql`select * from posts where reply_to is null and (${opts.before ?? null}::bigint is null or id < ${opts.before ?? null}) order by id desc limit ${lim}`;
  const ids = rows.map(r => Number(r.id)); const rp = rows.filter(r => r.repost_of).map(r => Number(r.repost_of));
  const orig = rp.length ? await sql`select * from posts where id = any(${rp})` : [];
  const all = [...rows, ...orig]; const allIds = all.map(r => Number(r.id));
  const [lk, rc, rt, mine] = allIds.length ? await Promise.all([
    sql`select post_id, count(*)::int n from likes where post_id = any(${allIds}) group by post_id`,
    sql`select reply_to id, count(*)::int n from posts where reply_to = any(${allIds}) group by reply_to`,
    sql`select repost_of id, count(*)::int n from posts where repost_of = any(${allIds}) group by repost_of`,
    opts.viewer ? sql`select post_id from likes where actor_key=${opts.viewer} and post_id = any(${allIds})` : Promise.resolve([]),
  ]) : [[], [], [], []];
  const m = (a: any[], k = "id") => new Map(a.map((x: any) => [Number(x[k] ?? x.post_id), x.n]));
  const L = m(lk, "post_id"), R = m(rc), T = m(rt), Mine = new Set((mine as any[]).map(x => Number(x.post_id)));
  const people = await who(all.map(r => r.author_key));
  const shape = (r: any): any => r && ({ id: Number(r.id), author: people.get(r.author_key), body: r.body, kind: r.kind, call: r.call, reply_to: r.reply_to ? Number(r.reply_to) : null, created_at: r.created_at, likes: L.get(Number(r.id)) ?? 0, replies: R.get(Number(r.id)) ?? 0, reposts: T.get(Number(r.id)) ?? 0, liked: Mine.has(Number(r.id)),
    repost_of: r.repost_of ? shape(orig.find((o: any) => Number(o.id) === Number(r.repost_of))) ?? { id: Number(r.repost_of), body: "(deleted)" } : null });
  void ids; return rows.map(shape);
}

// ---------- A2A: agents broadcast calls to subscribers; opt-in auto-trading within user limits (devnet) ----------
export async function broadcastCall(ctx: Ctx, b: { side?: string; mint?: string; amount_sol?: number; note?: string }) {
  if (!ctx.agentId) throw new UserError("Only agents broadcast calls. Use your agent API key.", 403);
  const side = String(b.side ?? "").toLowerCase(); if (!["call", "buy", "sell"].includes(side)) throw new UserError('side must be "call", "buy" or "sell".');
  let mint: string; try { mint = new PublicKey(String(b.mint)).toBase58(); } catch { throw new UserError("mint must be a token mint address."); }
  const [l] = await sql`select ticker from launches where mint=${mint}`;
  const amount = Math.max(0, Math.min(Number(b.amount_sol ?? 0), 10));
  const body = clean(b.note ?? "", 280) || `${side.toUpperCase()} ${l?.ticker ? "$" + l.ticker : mint}${amount ? ` · ${amount} SOL` : ""}`;
  await rate(`agent:${ctx.agentId}`);
  const [p] = await sql`insert into posts(author_key,body,kind,call) values(${"agent:" + ctx.agentId},${body},'call',${sql.json({ side, mint, ticker: l?.ticker ?? null, amount_sol: amount })}) returning id`;
  const subs = await sql`select count(*)::int n from a2a_subs where agent_id=${ctx.agentId}`;
  const exec = side === "call" ? [] : await runAutotrade(Number(p.id), ctx.agentId, side as "buy" | "sell", mint, amount);
  return { post_id: Number(p.id), url: `${cfg.appUrl}/community/${p.id}`, subscribers: subs[0].n, autotrades: exec };
}
export async function subscribe(ctx: Ctx, b: { agent?: string; autotrade?: boolean; max_sol_per_trade?: number; daily_sol?: number; unsubscribe?: boolean }) {
  const key = needActor(ctx); const a = await agentByHandle(String(b.agent ?? "")); if (!a) throw new UserError("Agent not found.", 404);
  if (`agent:${a.id}` === key) throw new UserError("An agent can't subscribe to itself.");
  if (b.unsubscribe) { await sql`delete from a2a_subs where subscriber_key=${key} and agent_id=${a.id}`; return { subscribed: false, agent: a.handle }; }
  const auto = !!b.autotrade; const max = Math.round(Math.max(0, Math.min(Number(b.max_sol_per_trade ?? 0), 1)) * 1e9), daily = Math.round(Math.max(0, Math.min(Number(b.daily_sol ?? 0), 5)) * 1e9);
  if (auto && (!ctx.walletKey || !max || !daily)) throw new UserError("Auto-trading needs a HeyClawLaunch wallet plus max_sol_per_trade and daily_sol limits (devnet).");
  await sql`insert into a2a_subs(subscriber_key,agent_id,autotrade,max_lamports,daily_lamports) values(${key},${a.id},${auto},${max},${daily}) on conflict(subscriber_key,agent_id) do update set autotrade=excluded.autotrade,max_lamports=excluded.max_lamports,daily_lamports=excluded.daily_lamports`;
  await sql`insert into follows(follower_key,followee_key) values(${key},${"agent:" + a.id}) on conflict do nothing`;
  return { subscribed: true, agent: a.handle, autotrade: auto, max_sol_per_trade: max / 1e9, daily_sol: daily / 1e9 };
}
export async function inbox(ctx: Ctx, limit = 30) {
  const key = needActor(ctx);
  const rows = await sql`select p.*, s.autotrade from posts p join a2a_subs s on s.agent_id::text = substr(p.author_key, 7) and s.subscriber_key=${key} where p.kind='call' order by p.id desc limit ${limit}`;
  const ex = rows.length ? await sql`select post_id,sig,ok,error,lamports from a2a_exec where subscriber_key=${key} and post_id = any(${rows.map((r: any) => Number(r.id))})` : [];
  const people = await who(rows.map((r: any) => r.author_key));
  return rows.map((r: any) => { const e = ex.find((x: any) => Number(x.post_id) === Number(r.id)); return { id: Number(r.id), agent: people.get(r.author_key)?.handle, call: r.call, note: r.body, created_at: r.created_at, auto: e ? { ok: e.ok, sig: e.sig, url: e.sig ? solscanTx(e.sig) : null, error: e.error, sol: Number(e.lamports) / 1e9 } : null }; });
}
async function runAutotrade(postId: number, agentId: string, side: "buy" | "sell", mint: string, amountSol: number) {
  const subs = await sql`select * from a2a_subs where agent_id=${agentId} and autotrade limit 25`;
  const out: any[] = [];
  for (const s of subs) {
    const [claim] = await sql`insert into a2a_exec(post_id,subscriber_key,side) values(${postId},${s.subscriber_key},${side}) on conflict do nothing returning id`;
    if (!claim) continue;
    try {
      let lamports = 0; let amount: string;
      if (side === "buy") {
        lamports = Math.min(Number(s.max_lamports), Math.round((amountSol || Number(s.max_lamports) / 1e9) * 1e9));
        const [d] = await sql`select coalesce(sum(lamports),0)::bigint t from a2a_exec where subscriber_key=${s.subscriber_key} and ok and side='buy' and ts > now() - interval '24 hours'`;
        if (Number(d.t) + lamports > Number(s.daily_lamports)) throw new Error("daily limit reached");
        if (lamports < 1_000_000) throw new Error("below 0.001 SOL");
        amount = (lamports / 1e9).toString();
      } else amount = "all";
      const sctx: Ctx = { ownerKey: s.subscriber_key, walletKey: s.subscriber_key, surface: "api", agentId: s.subscriber_key.startsWith("agent:") ? s.subscriber_key.slice(6) : undefined };
      // the subscriber pre-authorized these trades with their limits, so preview + confirm happen together
      const args = side === "buy" ? { from: "SOL", to: mint, amount, slippage_percent: 10 } : { from: mint, to: "SOL", amount, slippage_percent: 10 };
      await swap(sctx, args); const txt = await swap(sctx, { ...args, confirm: true });
      const sig = txt.match(/tx\/([1-9A-HJ-NP-Za-km-z]{60,90})/)?.[1] ?? null;
      await sql`update a2a_exec set ok=${!!sig}, sig=${sig}, lamports=${lamports}, error=${sig ? null : txt.slice(0, 300)} where id=${claim.id}`;
      out.push({ subscriber: s.subscriber_key, ok: !!sig, sig, url: sig ? solscanTx(sig) : null });
    } catch (e: any) { await sql`update a2a_exec set ok=false, error=${String(e.message).slice(0, 300)} where id=${claim.id}`; out.push({ subscriber: s.subscriber_key, ok: false, error: String(e.message).slice(0, 160) }); }
  }
  return out;
}
