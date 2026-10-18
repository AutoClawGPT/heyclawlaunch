import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { sha } from "@/lib/core/drafts";
export const SESSION_COOKIE = "hg_session";
export type User = { id: string; x_user_id: string | null; x_username: string | null; wallet_address: string | null; telegram_id: string | null };
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions(id,user_id,expires_at) values(${sha(token)},${userId},now()+interval '30 days')`;
  return token;
}
export async function userFromSessionToken(token?: string | null): Promise<User | null> {
  if (!token) return null;
  const [u] = await sql<User[]>`select u.* from sessions s join users u on u.id=s.user_id where s.id=${sha(token)} and s.expires_at>now() and not u.banned`;
  return u ?? null;
}
export async function currentUser(): Promise<User | null> { return userFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value); }
export const sessionCookie = (token: string) => `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${process.env.APP_URL?.startsWith("https") ? "; Secure" : ""}`;
export async function upsertWalletUser(address: string, current?: User | null): Promise<User> {
  const [ex] = await sql<User[]>`select * from users where wallet_address=${address}`;
  if (ex) return ex;
  if (current && !current.wallet_address) { const [u] = await sql<User[]>`update users set wallet_address=${address} where id=${current.id} returning *`; await sql`insert into user_identities values(${u.id},'wallet',${address}) on conflict do nothing`; return u; }
  const [u] = await sql<User[]>`insert into users(wallet_address) values(${address}) returning *`;
  await sql`insert into user_identities values(${u.id},'wallet',${address}) on conflict do nothing`;
  return u;
}
export async function upsertXUser(xId: string, username: string, avatar: string | null, current?: User | null): Promise<User> {
  const [ex] = await sql<User[]>`update users set x_username=${username}, x_avatar=${avatar} where x_user_id=${xId} returning *`;
  if (ex) return ex;
  if (current && !current.x_user_id) { const [u] = await sql<User[]>`update users set x_user_id=${xId}, x_username=${username}, x_avatar=${avatar} where id=${current.id} returning *`; await sql`insert into user_identities values(${u.id},'x',${xId}) on conflict do nothing`; return u; }
  const [u] = await sql<User[]>`insert into users(x_user_id,x_username,x_avatar) values(${xId},${username},${avatar}) returning *`;
  await sql`insert into user_identities values(${u.id},'x',${xId}) on conflict do nothing`;
  return u;
}
