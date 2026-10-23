import { friendlyChainError } from "@/lib/solana/errors";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { cfg, solscanTx } from "@/lib/config";
import { withCustodialSigner } from "@/lib/keystore";
import { conn, distribute, online, launchWallet, RENT_ZERO } from "@/lib/solana";
import { UserError } from "./validate";

const H = (s: string) => createHash("sha256").update("hcl-claim|" + s).digest("hex");
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLAIM_MIN = 650_240;
const fmt = (l: number) => Number((l / LAMPORTS_PER_SOL).toFixed(9)).toString();

/** One code per (mint, payout wallet). 120 random bits, stored only as a hash; unique constraints stop any reuse. Returns the plaintext once. */
export async function issueClaimCode(mint: string, wallet: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    const b = randomBytes(15); let c = ""; for (const x of b) c += B32[x & 31]; // 24 chars x 5 bits = 120 bits
    const code = `HCL-${c.match(/.{1,6}/g)!.join("-")}`;
    const [r] = await sql`insert into claim_codes(mint,payout_wallet,code_hash) values(${mint},${wallet},${H(code)}) on conflict do nothing returning id`;
    if (r) return code;
    const [ex] = await sql`select 1 from claim_codes where mint=${mint}`; if (ex) return null; // already issued for this launch
  }
  return null;
}
export async function checkClaimCode(wallet: string, code: string) {
  const norm = String(code ?? "").trim().toUpperCase();
  const [r] = await sql`select * from claim_codes where code_hash=${H(norm)}`;
  const ok = r && r.payout_wallet.length === wallet.length && timingSafeEqual(Buffer.from(r.payout_wallet), Buffer.from(wallet));
  if (!ok) throw new UserError("That wallet and claim code don't match.", 403);
  return r as { mint: string; payout_wallet: string };
}

/** Claimable creator fees per coin for any recipient wallet (on-chain creator vault via pump's fee-sharing config). */
export async function feesFor(wallet: string, mints?: string[]) {
  const coins = mints ? await sql`select mint,ticker,name,quote_mint,split_status,logo_cid,launched_at from launches where recipient=${wallet} and mint = any(${mints})` : await sql`select mint,ticker,name,quote_mint,split_status,logo_cid,launched_at from launches where recipient=${wallet} order by launched_at desc limit 50`;
  const share = (10_000 - cfg.platformBps) / 10_000;
  return Promise.all(coins.map(async (c: any) => {
    let claimable = 0, can = false;
    if (c.split_status === "done") try { const m: any = await online().getMinimumDistributableFee(new PublicKey(c.mint), launchWallet().publicKey, { quoteMint: new PublicKey(c.quote_mint), payer: launchWallet().publicKey }); claimable = Math.floor(Number(m.distributableFees.toString()) * share); can = !!m.canDistribute; } catch {}
    const [cl] = await sql`select coalesce(sum(lamports),0)::bigint s from fee_claims where mint=${c.mint} and wallet=${wallet}`;
    return { mint: c.mint, ticker: c.ticker, name: c.name, logo_cid: c.logo_cid, launched_at: c.launched_at, split: c.split_status, claimable_sol: claimable / 1e9, claimed_sol: Number(cl.s) / 1e9, can_claim: can && claimable >= CLAIM_MIN };
  }));
}

/** Pushes the waiting fees of `mints` to `wallet` with real txs (launch wallet pays the network fee). */
export async function claimTo(wallet: string, mints: string[], via: string) {
  const coins = await sql`select mint,ticker,quote_mint from launches where recipient=${wallet} and split_status='done' and mint = any(${mints})`;
  const waiting = new Map((await feesFor(wallet, mints)).map(f => [f.mint, f.claimable_sol * 1e9]));
  const out: { mint: string; ticker: string; sol?: number; sig?: string; note?: string }[] = [];
  for (const c of coins) {
    if ((waiting.get(c.mint) ?? 0) < CLAIM_MIN) { out.push({ mint: c.mint, ticker: c.ticker, note: `below the minimum (${fmt(CLAIM_MIN)} SOL)` }); continue; }
    try {
      const before = await conn().getBalance(new PublicKey(wallet));
      // Rent/fee: when the creator's payout wallet is a HeyClawLaunch custodial wallet with enough SOL, it pays the network fee + one-time vault rent itself (the claimer pays), so the platform keeps its full 20%. Otherwise the platform wallet fronts it as before.
      const [cw] = await sql`select owner_key from custodial_wallets where pubkey=${wallet}`.catch(() => []);
      const self = !!cw && before >= RENT_ZERO * 2 + 200_000;
      const r = self ? await withCustodialSigner(cw.owner_key, kp => distribute(new PublicKey(c.mint), new PublicKey(c.quote_mint), kp)) : await distribute(new PublicKey(c.mint), new PublicKey(c.quote_mint));
      if (r.skipped) { out.push({ mint: c.mint, ticker: c.ticker, note: "below the minimum" }); continue; }
      const got = (await conn().getBalance(new PublicKey(wallet))) - before - (before === 0 ? RENT_ZERO : 0); // net of the rent/fee when the claimer paid
      await sql`insert into fee_claims(mint,wallet,lamports,sig,via) values(${c.mint},${wallet},${Math.max(0, got)},${r.sig},${via}) on conflict do nothing`;
      await sql`update claim_codes set last_used_at=now() where mint=${c.mint}`;
      out.push({ mint: c.mint, ticker: c.ticker, sol: Math.max(0, got) / 1e9, sig: r.sig });
    } catch (e: any) { out.push({ mint: c.mint, ticker: c.ticker, note: `failed: ${friendlyChainError(e)}` }); }
  }
  return out.map(o => ({ ...o, url: o.sig ? solscanTx(o.sig) : undefined }));
}

/** Scanner: what a wallet launched / earns. Includes coins paying it and coins launched by accounts tied to it. */
export async function scanWallet(wallet: string) {
  try { new PublicKey(wallet); } catch { throw new UserError("That isn't a Solana address."); }
  const owners = (await sql`select 'user:'||id k from users where wallet_address=${wallet} union select owner_key k from custodial_wallets where pubkey=${wallet} union select 'agent:'||id from agents where wallet_address=${wallet} or payout_address=${wallet}`).map((r: any) => r.k);
  const launched = await sql`select mint,ticker,name,logo_cid,recipient,fee_label,launched_at from launches where owner_key = any(${owners}) or recipient=${wallet} order by launched_at desc limit 100`;
  const fees = await feesFor(wallet);
  const tot = fees.reduce((a, f) => ({ claimable: a.claimable + f.claimable_sol, claimed: a.claimed + f.claimed_sol }), { claimable: 0, claimed: 0 });
  return { wallet, launched, fees, totals: { launched: launched.length, paying_this_wallet: fees.length, claimable_sol: tot.claimable, claimed_sol: tot.claimed, earned_sol: tot.claimable + tot.claimed } };
}
