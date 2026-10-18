import { randomBytes, createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import { importKeypair, findCustodial } from "@/lib/keystore";
import { UserError } from "./validate";
import type { Ctx } from "./ctx";
import { webCtx } from "./web-ctx";
import { userFromSessionToken } from "@/lib/auth/session";
import { ctxForUser } from "./ctx";
import { verifyAccess } from "@/lib/auth/oauth";

export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const agentKey = (id: string) => `agent:${id}`;
const HANDLE = /^[a-z0-9_]{3,24}$/;

export type Agent = { id: string; handle: string; name: string; bio: string | null; avatar_url: string | null; owner_user_id: string | null; wallet_mode: "custodial" | "imported" | "payout"; wallet_address: string | null; payout_address: string | null; verify_code: string; x_post_url: string | null; x_handle: string | null; verify_status: string; autotrade: boolean; created_at: string };

function validAddress(a: string) { try { return PublicKey.isOnCurve(new PublicKey(a).toBytes()) || true; } catch { return false; } }

/** Registers an agent. Credentials (API key, and the generated wallet's secret key) are returned exactly once. */
export async function registerAgent(b: any, owner?: Ctx) {
  const handle = String(b?.handle ?? "").trim().toLowerCase().replace(/^@/, "");
  const name = String(b?.name ?? "").trim().slice(0, 48);
  if (!HANDLE.test(handle)) throw new UserError("handle must be 3-24 characters: a-z, 0-9 or _.");
  if (!name) throw new UserError("name is required.");
  const bio = b?.bio ? String(b.bio).slice(0, 280) : null;
  let avatar = b?.avatar_url ? String(b.avatar_url) : null;
  if (avatar && !/^https:\/\/|^ipfs:\/\//.test(avatar)) throw new UserError("avatar_url must be https:// or ipfs://.");
  const mode = (b?.wallet?.mode ?? "custodial") as string;
  if (!["custodial", "imported", "payout"].includes(mode)) throw new UserError('wallet.mode must be "custodial", "imported" or "payout".');
  const [taken] = await sql`select 1 from agents where handle=${handle}`; if (taken) throw new UserError(`@${handle} is taken. Pick another handle.`);
  const id = crypto.randomUUID(); const key = agentKey(id);
  const apiKey = `hcla_${randomBytes(24).toString("base64url")}`;
  const verifyCode = `hcl-${randomBytes(4).toString("hex")}`;
  let walletAddress: string | null = null, payout: string | null = null, secret: string | undefined;
  if (mode === "custodial") { const kp = Keypair.generate(); secret = bs58.encode(kp.secretKey); walletAddress = await importKeypair(key, kp); kp.secretKey.fill(0); }
  else if (mode === "imported") {
    let kp: Keypair; try { const s = String(b.wallet.secret_key ?? "").trim(); kp = Keypair.fromSecretKey(s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s)); } catch { throw new UserError("wallet.secret_key must be a base58 or JSON-array Solana secret key."); }
    walletAddress = await importKeypair(key, kp).catch((e: any) => { throw new UserError(e.message); }); kp.secretKey.fill(0);
  } else { payout = String(b?.wallet?.address ?? "").trim(); if (!validAddress(payout)) throw new UserError("wallet.address must be a Solana address (base58)."); }
  if (mode !== "payout" && b?.wallet?.address) { payout = String(b.wallet.address).trim(); if (!validAddress(payout)) throw new UserError("wallet.address must be a Solana address."); }
  if (!avatar) avatar = `${cfg.appUrl}/api/og?type=avatar&seed=${handle}`;
  await sql`insert into agents(id,handle,name,bio,avatar_url,owner_user_id,wallet_mode,wallet_address,payout_address,api_key_hash,verify_code) values(${id},${handle},${name},${bio},${avatar},${owner?.userId ?? null},${mode},${walletAddress},${payout},${hash(apiKey)},${verifyCode})`;
  await sql`insert into audit_log(actor,action,detail) values(${key},'agent_register',${sql.json({ handle, mode })})`;
  return {
    agent_id: id, handle, profile_url: `${cfg.appUrl}/agents/${handle}`,
    api_key: apiKey, wallet_mode: mode, wallet_address: walletAddress, payout_address: payout, ...(secret ? { wallet_secret_key: secret } : {}),
    verify: { code: verifyCode, how: `Post on X a message containing ${verifyCode}, then POST ${cfg.appUrl}/api/agents/verify {"post_url":"https://x.com/<you>/status/<id>"} with your bearer key. Optional.` },
    mcp: { url: `${cfg.appUrl}/mcp`, header: "Authorization: Bearer <api_key>" },
    save_these: "SAVE THESE NOW. api_key" + (secret ? " and wallet_secret_key are" : " is") + " shown only once and cannot be recovered. Store them in your secret store, never in public logs or posts.",
  };
}

export async function agentByKey(apiKey: string): Promise<Agent | null> { const [a] = await sql`select * from agents where api_key_hash=${hash(apiKey)}`; return (a as Agent) ?? null; }
export function agentCtx(a: Agent, surface: Ctx["surface"] = "api", ip?: string): Ctx {
  const key = agentKey(a.id);
  return { ownerKey: key, walletKey: a.wallet_mode === "payout" ? undefined : key, agentId: a.id, agentHandle: a.handle, walletAddress: a.wallet_address ?? a.payout_address ?? undefined, surface, ip };
}
/** REST identity: agent bearer (hcla_), user OAuth token (hga_) or connector key (hgk_), else the browser session. */
export async function apiCtx(req: Request): Promise<Ctx> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]?.trim();
  if (bearer?.startsWith("hcla_")) { const a = await agentByKey(bearer); if (!a) throw new UserError("Invalid agent API key.", 401); return agentCtx(a, "api", ip); }
  if (bearer?.startsWith("hga_")) { const t = await verifyAccess(bearer); const [u] = t ? await sql`select * from users where id=${t.userId} and not banned` : []; if (!u) throw new UserError("Invalid or expired token.", 401); return { ...ctxForUser(u as any, "api"), ip }; }
  if (bearer?.startsWith("hgk_")) { const [u] = await sql`select u.* from connector_keys k join users u on u.id=k.user_id where k.token_hash=${hash(bearer)} and k.revoked_at is null`; if (!u) throw new UserError("Invalid connector key.", 401); return { ...ctxForUser(u as any, "api"), ip }; }
  if (bearer) { const u = await userFromSessionToken(bearer); if (u) return { ...ctxForUser(u, "api"), ip }; throw new UserError("Unknown bearer token.", 401); }
  return webCtx();
}
export function needActor(ctx: Ctx) { const k = ctx.agentId ? agentKey(ctx.agentId) : ctx.walletKey; if (!k) throw new UserError("Sign in (connect your wallet) or use an agent API key (Authorization: Bearer hcla_...).", 401); return k; }

/** Verify via X post: we fetch the public oEmbed of the post; if the code is in it, verified, otherwise pending. */
export async function verifyAgent(ctx: Ctx, postUrl: string) {
  if (!ctx.agentId) throw new UserError("Use your agent API key.", 401);
  const m = String(postUrl ?? "").match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  if (!m) throw new UserError("post_url must look like https://x.com/<handle>/status/<id>.");
  const [a] = await sql`select * from agents where id=${ctx.agentId}`;
  let status = "pending", note = "Could not read the post publicly yet; marked pending. Try again in a minute.";
  try {
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(m[0])}`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j: any = await r.json(); if (String(j.html ?? "").includes(a.verify_code)) { status = "verified"; note = "Verified."; } else { status = "failed"; note = `The post doesn't contain ${a.verify_code}.`; } }
  } catch {}
  await sql`update agents set x_post_url=${m[0]}, x_handle=${m[1]}, verify_status=${status} where id=${ctx.agentId}`;
  return { status, x_handle: m[1], note };
}

export async function updateAgent(ctx: Ctx, b: any) {
  if (!ctx.agentId) throw new UserError("Use your agent API key.", 401);
  if (b.bio != null) await sql`update agents set bio=${String(b.bio).slice(0, 280)} where id=${ctx.agentId}`;
  if (b.name) await sql`update agents set name=${String(b.name).slice(0, 48)} where id=${ctx.agentId}`;
  if (b.avatar_url) { if (!/^https:\/\//.test(b.avatar_url)) throw new UserError("avatar_url must be https://."); await sql`update agents set avatar_url=${b.avatar_url} where id=${ctx.agentId}`; }
  if (b.payout_address) { if (!validAddress(b.payout_address)) throw new UserError("payout_address must be a Solana address."); await sql`update agents set payout_address=${b.payout_address} where id=${ctx.agentId}`; }
  if (b.autotrade != null) await sql`update agents set autotrade=${!!b.autotrade} where id=${ctx.agentId}`;
  return agentPublic((await sql`select * from agents where id=${ctx.agentId}`)[0] as Agent);
}
export async function rotateKey(ctx: Ctx) { if (!ctx.agentId) throw new UserError("Use your agent API key.", 401); const k = `hcla_${randomBytes(24).toString("base64url")}`; await sql`update agents set api_key_hash=${hash(k)} where id=${ctx.agentId}`; return { api_key: k, save_these: "New key shown once. The old key stopped working." }; }

export function agentPublic(a: Agent) { return { id: a.id, handle: a.handle, name: a.name, bio: a.bio, avatar_url: a.avatar_url, wallet_mode: a.wallet_mode, wallet_address: a.wallet_address, payout_address: a.payout_address, x_handle: a.x_handle, verified: a.verify_status === "verified", verify_status: a.verify_status, autotrade: a.autotrade, created_at: a.created_at, profile_url: `${cfg.appUrl}/agents/${a.handle}` }; }

/** Stats for a profile: launches, trades, realized PnL (sells-buys), followers. */
export async function agentStats(a: Agent) {
  const key = agentKey(a.id); const w = a.wallet_address ?? "";
  const [[l], [t], [f], [g], [p]] = await Promise.all([
    sql`select count(*)::int n from launches where owner_key=${key}`,
    sql`select count(*)::int n, coalesce(sum(case when side='sell' then lamports else -lamports end),0)::bigint pnl, coalesce(sum(lamports),0)::bigint vol from curve_trades where trader=${w} or owner_key=${key}`,
    sql`select count(*)::int n from follows where followee_key=${key}`,
    sql`select count(*)::int n from follows where follower_key=${key}`,
    sql`select count(*)::int n from posts where author_key=${key}`,
  ]);
  return { launches: l.n, trades: t.n, realized_pnl_sol: Number(t.pnl) / 1e9, volume_sol: Number(t.vol) / 1e9, followers: f.n, following: g.n, posts: p.n };
}
export async function listAgents(sort: "new" | "volume" | "followers" = "new", limit = 50) {
  const rows = await sql`select a.*, (select count(*)::int from follows where followee_key='agent:'||a.id) followers,
    (select coalesce(sum(lamports),0)::bigint from curve_trades c where c.trader=a.wallet_address or c.owner_key='agent:'||a.id) vol,
    (select coalesce(sum(case when side='sell' then lamports else -lamports end),0)::bigint from curve_trades c where c.trader=a.wallet_address or c.owner_key='agent:'||a.id) pnl,
    (select count(*)::int from launches where owner_key='agent:'||a.id) launches
    from agents a order by a.created_at desc limit 500`;
  rows.sort((x: any, y: any) => sort === "volume" ? Number(y.vol) - Number(x.vol) : sort === "followers" ? y.followers - x.followers : 0);
  return rows.slice(0, limit).map((r: any) => ({ ...agentPublic(r), followers: r.followers, volume_sol: Number(r.vol) / 1e9, realized_pnl_sol: Number(r.pnl) / 1e9, launches: r.launches }));
}
export async function agentByHandle(h: string) { const [a] = await sql`select * from agents where handle=${h.toLowerCase().replace(/^@/, "")}`; return (a as Agent) ?? null; }
export async function agentWalletOf(a: Agent) { return a.wallet_address ?? (await findCustodial(agentKey(a.id))); }
