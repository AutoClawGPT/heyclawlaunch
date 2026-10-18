import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "crypto";
import { Keypair } from "@solana/web3.js";
import { sql } from "@/lib/db";

const master = () => Buffer.from(process.env.KEYSTORE_MASTER_KEY!, "hex");
function seal(key: Uint8Array, data: Uint8Array) { const iv = randomBytes(12); return { iv, ct: Buffer.from(gcm(key, iv).encrypt(data)) }; }
const open = (key: Uint8Array, iv: Uint8Array, ct: Uint8Array) => gcm(key, iv).decrypt(ct);

/** owner_key: "x:<id>" | "user:<uuid>" | "tg:<id>" */
export async function getOrCreateCustodial(ownerKey: string): Promise<string> {
  const [row] = await sql`select pubkey from custodial_wallets where owner_key=${ownerKey}`;
  if (row) return row.pubkey;
  const kp = Keypair.generate();
  const dek = randomBytes(32);
  const s = seal(dek, kp.secretKey), w = seal(master(), dek);
  dek.fill(0); kp.secretKey.fill(0);
  await sql`insert into custodial_wallets(owner_key,pubkey,ciphertext,iv,wrapped_dek,dek_iv) values(${ownerKey},${kp.publicKey.toBase58()},${s.ct},${s.iv},${w.ct},${w.iv}) on conflict(owner_key) do nothing`;
  const [r2] = await sql`select pubkey from custodial_wallets where owner_key=${ownerKey}`;
  return r2.pubkey;
}
export async function findCustodial(ownerKey: string): Promise<string | null> {
  const [row] = await sql`select pubkey from custodial_wallets where owner_key=${ownerKey}`;
  return row?.pubkey ?? null;
}
/** Decrypts only inside the signer path; caller must not log the keypair. */
export async function withCustodialSigner<T>(ownerKey: string, fn: (kp: Keypair) => Promise<T>): Promise<T> {
  const [row] = await sql`select * from custodial_wallets where owner_key=${ownerKey}`;
  if (!row) throw new Error("no wallet");
  const dek = open(master(), row.dek_iv, row.wrapped_dek);
  const sk = open(dek, row.iv, row.ciphertext);
  dek.fill(0);
  const kp = Keypair.fromSecretKey(sk);
  try { return await fn(kp); } finally { sk.fill(0); kp.secretKey.fill(0); }
}
