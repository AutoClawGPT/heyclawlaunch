import { randomBytes } from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
export type SiwsInput = { domain: string; address?: string; statement: string; uri: string; version: "1"; chainId: string; nonce: string; issuedAt: string; expirationTime: string };
export const siwsDomain = () => process.env.SIWS_DOMAIN ?? new URL(cfg.appUrl).host;
export async function newSiwsInput(): Promise<SiwsInput> {
  const nonce = randomBytes(16).toString("hex");
  await sql`insert into siws_nonces values(${nonce}, now()+interval '5 minutes')`;
  const now = new Date();
  return { domain: siwsDomain(), statement: `Sign in to ${cfg.brand}`, uri: cfg.appUrl, version: "1", chainId: cfg.cluster === "mainnet-beta" ? "mainnet" : cfg.cluster, nonce, issuedAt: now.toISOString(), expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString() };
}
/** Same text format as @solana/wallet-standard-util createSignInMessageText (SIWS / CAIP-122 style). */
export function messageText(i: SiwsInput & { address: string }) {
  let m = `${i.domain} wants you to sign in with your Solana account:\n${i.address}`;
  if (i.statement) m += `\n\n${i.statement}`;
  const f: string[] = [];
  if (i.uri) f.push(`URI: ${i.uri}`); if (i.version) f.push(`Version: ${i.version}`); if (i.chainId) f.push(`Chain ID: ${i.chainId}`);
  if (i.nonce) f.push(`Nonce: ${i.nonce}`); if (i.issuedAt) f.push(`Issued At: ${i.issuedAt}`); if (i.expirationTime) f.push(`Expiration Time: ${i.expirationTime}`);
  if (f.length) m += `\n\n${f.join("\n")}`;
  return m;
}
/** Verifies a SIWS sign-in. signedMessage = exact bytes the wallet signed (base64); signature base64; address base58. */
export async function verifySiws(p: { address: string; signedMessage: string; signature: string }): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  let msgBytes: Uint8Array, sig: Uint8Array, pk: Uint8Array;
  try { msgBytes = Buffer.from(p.signedMessage, "base64"); sig = Buffer.from(p.signature, "base64"); pk = bs58.decode(p.address); } catch { return { ok: false, error: "malformed" }; }
  if (pk.length !== 32 || sig.length !== 64) return { ok: false, error: "malformed" };
  if (!nacl.sign.detached.verify(msgBytes, sig, pk)) return { ok: false, error: "bad signature" };
  const text = new TextDecoder().decode(msgBytes);
  const [head, addrLine] = text.split("\n");
  if (head !== `${siwsDomain()} wants you to sign in with your Solana account:`) return { ok: false, error: "wrong domain" };
  if (addrLine !== p.address) return { ok: false, error: "address mismatch" };
  const field = (k: string) => text.match(new RegExp(`^${k}: (.+)$`, "m"))?.[1];
  const nonce = field("Nonce"), exp = field("Expiration Time");
  if (!nonce) return { ok: false, error: "missing nonce" };
  if (exp && new Date(exp).getTime() < Date.now()) return { ok: false, error: "expired" };
  const [n] = await sql`delete from siws_nonces where nonce=${nonce} and expires_at>now() returning nonce`;
  if (!n) return { ok: false, error: "unknown or reused nonce" };
  return { ok: true, address: p.address };
}
