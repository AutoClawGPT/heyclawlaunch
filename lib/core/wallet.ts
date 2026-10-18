import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { sql } from "@/lib/db";
import { cfg, solscanTx } from "@/lib/config";
import type { Ctx } from "./ctx";
import { UserError, vAddress } from "./validate";
import { getOrCreateCustodial, findCustodial, withCustodialSigner } from "@/lib/keystore";
import { conn, online, distribute, transferFrom, sendV0, RENT_ZERO, curveExists, NATIVE_MINT, launchWallet } from "@/lib/solana";
import { PUMP_SDK, getBuyV3TokenAmountFromQuoteAmount } from "@/lib/solana/pump";
import { sha } from "./drafts";

export const NOT_CONNECTED = () => `You're not connected to a ${cfg.brand} wallet here. Add the connector ${cfg.appUrl}/mcp/wallet and click Authorize once (sign in with your Solana wallet or X), or sign in at ${cfg.appUrl}/claim.`;
export function need(ctx: Ctx) { if (!ctx.walletKey) throw new UserError(NOT_CONNECTED()); return ctx.walletKey; }
const fmt = (n: number, d = 9) => Number(n.toFixed(d)).toString();

async function holdings(owner: PublicKey) {
  const out: { mint: string; amount: string; ui: number; decimals: number; program: string }[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const r = await conn().getParsedTokenAccountsByOwner(owner, { programId });
    for (const a of r.value) { const i = (a.account.data as any).parsed.info; if (Number(i.tokenAmount.amount) > 0) out.push({ mint: i.mint, amount: i.tokenAmount.amount, ui: i.tokenAmount.uiAmount, decimals: i.tokenAmount.decimals, program: programId.toBase58() }); }
  }
  return out;
}
async function tickerOf(mint: string) { const [l] = await sql`select ticker from launches where mint=${mint}`; return l?.ticker as string | undefined; }

async function feesWaiting(pubkey: string) {
  const coins = await sql`select mint,ticker,quote_mint,split_status from launches where recipient=${pubkey} order by launched_at desc`;
  const res: { mint: string; ticker: string; lamports: number; can: boolean; min: number; split: string }[] = [];
  for (const c of coins) {
    if (c.split_status !== "done") { res.push({ mint: c.mint, ticker: c.ticker, lamports: 0, can: false, min: 0, split: c.split_status }); continue; }
    try {
      const m: any = await online().getMinimumDistributableFee(new PublicKey(c.mint), launchWallet().publicKey, { quoteMint: new PublicKey(c.quote_mint), payer: launchWallet().publicKey });
      const share = (10_000 - cfg.platformBps) / 10_000;
      res.push({ mint: c.mint, ticker: c.ticker, lamports: Math.floor(Number(m.distributableFees.toString()) * share), can: !!m.canDistribute, min: Number(m.minimumRequired.toString()), split: "done" });
    } catch { res.push({ mint: c.mint, ticker: c.ticker, lamports: 0, can: false, min: 0, split: "done" }); }
  }
  return res;
}

export async function myWallet(ctx: Ctx) {
  const key = need(ctx);
  const addr = await getOrCreateCustodial(key);
  const pk = new PublicKey(addr);
  const [sol, toks, fees] = await Promise.all([conn().getBalance(pk), holdings(pk), feesWaiting(addr)]);
  const lines = [`${cfg.brand} wallet: ${addr}${cfg.cluster !== "mainnet-beta" ? ` (${cfg.cluster})` : ""}`, `SOL: ${fmt(sol / LAMPORTS_PER_SOL)}`];
  if (ctx.walletAddress) lines.push(`Signed-in wallet: ${ctx.walletAddress}`);
  lines.push(`Tokens (${toks.length}):`); for (const t of toks) lines.push(`- ${(await tickerOf(t.mint)) ? "$" + (await tickerOf(t.mint)) : t.mint}: ${t.ui} (mint ${t.mint})`);
  const total = fees.reduce((s, f) => s + f.lamports, 0);
  lines.push(`Creator fees waiting: ${fmt(total / LAMPORTS_PER_SOL)} SOL`);
  lines.push(`Coins paying this wallet (${fees.length}):`); for (const f of fees) lines.push(`- $${f.ticker} ${f.mint}: ${fmt(f.lamports / LAMPORTS_PER_SOL)} SOL waiting${f.split !== "done" ? ` (fee split ${f.split})` : ""}`);
  return lines.join("\n");
}

const CLAIM_MIN = 650_240; // lamports, same claim minimum as HeyGrok (0.00065024 SOL)
export async function claimFees(ctx: Ctx) {
  const key = need(ctx);
  const addr = await findCustodial(key) ?? await getOrCreateCustodial(key);
  const coins = await sql`select mint,ticker,quote_mint from launches where recipient=${addr} and split_status='done'`;
  if (!coins.length) return `nothing to claim yet (minimum 0.00065024 SOL): no coins pay fees to ${addr}.`;
  const lines: string[] = []; let total = 0;
  const waiting = new Map((await feesWaiting(addr).catch(() => [] as any[])).map((f: any) => [f.mint, f.lamports]));
  for (const c of coins) {
    if (waiting.size && (waiting.get(c.mint) ?? 0) < CLAIM_MIN) { lines.push(`- $${c.ticker}: below the minimum, skipped`); continue; }
    try {
      const before = await conn().getBalance(new PublicKey(addr));
      const r = await distribute(new PublicKey(c.mint), new PublicKey(c.quote_mint));
      if (r.skipped) { lines.push(`- $${c.ticker}: below the minimum, skipped`); continue; }
      const after = await conn().getBalance(new PublicKey(addr));
      const got = after - before - (before === 0 ? RENT_ZERO : 0);
      if (got <= 0) { lines.push(`- $${c.ticker}: nothing arrived (fees below the minimum)`); continue; }
      total += got;
      lines.push(`- $${c.ticker}: +${fmt(got / LAMPORTS_PER_SOL)} SOL ${solscanTx(r.sig)}`);
      await sql`insert into wallet_ops(owner_key,kind,status,sig) values(${key},'claim','done',${r.sig})`;
      await sql`insert into fee_claims(mint,wallet,lamports,sig,via) values(${c.mint},${addr},${got},${r.sig},'custodial') on conflict do nothing`;
    } catch (e: any) { lines.push(`- $${c.ticker}: failed (${String(e.message).slice(0, 120)})`); }
  }
  if (total <= 0) return `nothing to claim yet (minimum 0.00065024 SOL)\n${lines.join("\n")}`;
  return `Claimed into ${addr}:\n${lines.join("\n")}\nTotal: ${fmt(total / LAMPORTS_PER_SOL)} SOL`;
}

type Tok = { mint: PublicKey | "SOL"; symbol: string; decimals: number; program?: PublicKey };
async function resolveToken(input: string | undefined, owner?: PublicKey): Promise<Tok> {
  const s = (input ?? "SOL").trim().replace(/^\$/, "");
  if (!s || /^(sol|wsol|solana)$/i.test(s)) return { mint: "SOL", symbol: "SOL", decimals: 9 };
  let mint: PublicKey | undefined;
  try { mint = new PublicKey(s); } catch {}
  if (!mint) {
    const [l] = await sql`select mint from launches where upper(ticker)=upper(${s}) order by launched_at desc limit 1`;
    if (l) mint = new PublicKey(l.mint);
    else if (owner) for (const h of await holdings(owner)) if ((await tickerOf(h.mint))?.toUpperCase() === s.toUpperCase()) mint = new PublicKey(h.mint);
    if (!mint && cfg.cluster === "mainnet-beta") {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(s)}`).then(r => r.json()).catch(() => []);
      const t = (r as any[]).find(x => x.symbol?.toUpperCase() === s.toUpperCase()); if (t) mint = new PublicKey(t.id);
    }
  }
  if (!mint) throw new UserError(`I don't know the token "${input}". Give its mint address.`);
  const info = await conn().getParsedAccountInfo(mint);
  const dec = (info.value?.data as any)?.parsed?.info?.decimals;
  if (dec === undefined) throw new UserError(`${mint.toBase58()} isn't a token mint.`);
  return { mint, symbol: (await tickerOf(mint.toBase58())) ?? mint.toBase58().slice(0, 6), decimals: dec, program: info.value!.owner };
}
function toBase(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount.trim())) throw new UserError(`"${amount}" isn't a valid amount. Use a number like 0.5, or "all".`);
  const [i, f = ""] = amount.trim().split("."); return BigInt(i) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}
const fromBase = (v: bigint, d: number) => (Number(v) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });
async function balanceOf(owner: PublicKey, t: Tok): Promise<bigint> {
  if (t.mint === "SOL") return BigInt(await conn().getBalance(owner));
  try { return BigInt((await conn().getTokenAccountBalance(getAssociatedTokenAddressSync(t.mint, owner, true, t.program))).value.amount); } catch { return 0n; }
}
export async function previewGate(key: string, kind: string, args: object, confirm?: boolean) {
  const h = sha(JSON.stringify({ kind, ...args }));
  if (!confirm) { await sql`insert into wallet_ops(owner_key,kind,args_hash,status) values(${key},${kind},${h},'preview')`; return false; }
  const [p] = await sql`select id from wallet_ops where owner_key=${key} and kind=${kind} and args_hash=${h} and status='preview' and created_at > now() - interval '15 minutes' order by created_at desc limit 1`;
  if (!p) throw new UserError("Show the PREVIEW first: call again WITHOUT confirm, show it to the user, and only after a clear yes call with the same arguments and confirm: true.");
  const [lock] = await sql`update wallet_ops set status='executing' where id=${p.id} and status='preview' returning id`;
  if (!lock) throw new UserError("That action is already being executed.");
  return p.id as string;
}

export async function withdraw(ctx: Ctx, a: { to: string; amount: string; token?: string; confirm?: boolean }) {
  const key = need(ctx);
  const addr = new PublicKey(await getOrCreateCustodial(key));
  const to = new PublicKey(vAddress(a.to));
  const t = await resolveToken(a.token, addr);
  const bal = await balanceOf(addr, t);
  const amt = /^all$/i.test(a.amount.trim()) ? bal : toBase(a.amount, t.decimals);
  if (amt <= 0n) throw new UserError(`Nothing to withdraw: the ${t.symbol} balance is 0.`);
  if (amt > bal) throw new UserError(`Not enough ${t.symbol}: balance ${fromBase(bal, t.decimals)}.`);
  if (t.mint === "SOL" && amt < bal && bal - amt < BigInt(RENT_ZERO)) throw new UserError(`That would leave ${fromBase(bal - amt, 9)} SOL, below the 0.00065024 SOL rent minimum. Withdraw "all" or leave at least 0.00065024 SOL.`);
  if (t.mint === "SOL") { const toBal = await conn().getBalance(to); if (toBal === 0 && amt < BigInt(RENT_ZERO)) throw new UserError("The destination is empty, so it must receive at least 0.00065024 SOL."); }
  const norm = { to: to.toBase58(), amount: a.amount.trim().toLowerCase(), token: t.mint === "SOL" ? "SOL" : t.mint.toBase58() };
  const opId = await previewGate(key, "withdraw", norm, a.confirm);
  if (!opId) return `PREVIEW: withdraw ${fromBase(amt, t.decimals)} ${t.symbol} from ${addr.toBase58()} to ${to.toBase58()}. Network fee: paid by ${cfg.brand}.\nShow this to the user; after a clear yes call withdraw again with the same arguments and confirm: true.`;
  try {
    const sig = await withCustodialSigner(key, kp => transferFrom(kp, to, { mint: t.mint, amount: amt }));
    await sql`update wallet_ops set status='done', sig=${sig} where id=${opId}`;
    return `Sent ${fromBase(amt, t.decimals)} ${t.symbol} to ${to.toBase58()}.\nsignature ${sig}\n${solscanTx(sig)}`;
  } catch (e: any) { await sql`update wallet_ops set status='failed', error=${String(e.message).slice(0, 300)} where id=${opId}`; throw new UserError(`Withdraw failed: ${String(e.message).slice(0, 200)}`); }
}

/** Swap: mainnet → Jupiter Swap API v2 (order/execute). Devnet/localnet → pump.fun bonding-curve buy/sell (Jupiter has no devnet). */
export async function swap(ctx: Ctx, a: { from?: string; to: string; amount: string; slippage_percent?: number; confirm?: boolean }) {
  const key = need(ctx);
  const addr = new PublicKey(await getOrCreateCustodial(key));
  const from = await resolveToken(a.from, addr), to = await resolveToken(a.to, addr);
  if (from.mint === to.mint || (from.mint !== "SOL" && to.mint !== "SOL" && from.mint.equals(to.mint))) throw new UserError("From and to are the same token.");
  const slip = Math.min(25, Math.max(0.1, a.slippage_percent ?? 3));
  const bal = await balanceOf(addr, from);
  const amt = /^all$/i.test(a.amount.trim()) ? (from.mint === "SOL" ? bal - 5_000_000n : bal) : toBase(a.amount, from.decimals);
  if (amt <= 0n || amt > bal) throw new UserError(`Not enough ${from.symbol}: balance ${fromBase(bal, from.decimals)}.`);
  const norm = { from: from.mint === "SOL" ? "SOL" : from.mint.toBase58(), to: to.mint === "SOL" ? "SOL" : to.mint.toBase58(), amount: a.amount.trim().toLowerCase(), slip };
  const useJup = cfg.cluster === "mainnet-beta";
  let expected: string, route: string, exec: () => Promise<string>;
  if (useJup) {
    const q = new URLSearchParams({ inputMint: from.mint === "SOL" ? NATIVE_MINT.toBase58() : from.mint.toBase58(), outputMint: to.mint === "SOL" ? NATIVE_MINT.toBase58() : to.mint.toBase58(), amount: amt.toString(), taker: addr.toBase58(), slippageBps: String(Math.round(slip * 100)) });
    const o: any = await fetch(`https://api.jup.ag/swap/v2/order?${q}`, { headers: { "x-api-key": process.env.JUP_API_KEY! } }).then(r => r.json());
    if (!o?.outAmount) throw new UserError(`No route found: ${o?.error ?? "unknown"}`);
    expected = `${fromBase(BigInt(o.outAmount), to.decimals)} ${to.symbol} (price impact ${o.priceImpactPct ?? "?"}%)`; route = "Jupiter";
    exec = () => withCustodialSigner(key, async kp => {
      const tx = VersionedTransaction.deserialize(Buffer.from(o.transaction, "base64")); tx.sign([kp]);
      const r: any = await fetch("https://api.jup.ag/swap/v2/execute", { method: "POST", headers: { "x-api-key": process.env.JUP_API_KEY!, "content-type": "application/json" }, body: JSON.stringify({ signedTransaction: Buffer.from(tx.serialize()).toString("base64"), requestId: o.requestId }) }).then(r => r.json());
      if (r.status !== "Success") throw new Error(r.error ?? "execute failed"); return r.signature;
    });
  } else {
    const coin = from.mint === "SOL" ? to : from;
    if (coin.mint === "SOL" || (from.mint !== "SOL" && to.mint !== "SOL")) throw new UserError(`On ${cfg.cluster} only SOL ⇄ pump.fun curve coin swaps are available (Jupiter is mainnet-only).`);
    const mint = coin.mint as PublicKey;
    if (!(await curveExists(mint))) throw new UserError("That token has no pump.fun bonding curve on this cluster.");
    const sdk = online(); const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig()]);
    route = `pump.fun bonding curve (${cfg.cluster})`;
    if (from.mint === "SOL") {
      const st = await sdk.fetchBuyState(mint, addr, coin.program);
      if (st.bondingCurve.complete) throw new UserError("This coin graduated; swap it on mainnet through Jupiter.");
      const out = getBuyV3TokenAmountFromQuoteAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: st.bondingCurve, amount: new BN(amt.toString()), curveBaseTokenBalance: st.curveBaseTokenBalance });
      expected = `${fromBase(BigInt(out.toString()), coin.decimals)} $${coin.symbol}`;
      exec = () => withCustodialSigner(key, async kp => sendV0(await PUMP_SDK.buyExactQuoteInV3Instructions({ bondingCurve: st.bondingCurve, associatedUserAccountInfo: st.associatedUserAccountInfo, mint, user: addr, amount: out, quoteAmount: new BN(amt.toString()), slippage: slip, tokenProgram: coin.program, quoteTokenProgram: st.quoteTokenProgram }), [kp]));
    } else {
      const ss = await sdk.fetchSellState(mint, addr, coin.program);
      const { getSellSolAmountFromTokenAmount } = (await import("@/lib/solana/pump")).default;
      const out = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: ss.bondingCurve, amount: new BN(amt.toString()) });
      expected = `${fromBase(BigInt(out.toString()), 9)} SOL`;
      exec = () => withCustodialSigner(key, async kp => sendV0(await PUMP_SDK.sellV3Instructions({ bondingCurve: ss.bondingCurve, mint, user: addr, amount: new BN(amt.toString()), quoteAmount: out, slippage: slip, tokenProgram: coin.program, quoteTokenProgram: ss.quoteTokenProgram }), [kp]));
    }
  }
  const opId = await previewGate(key, "swap", norm, a.confirm);
  if (!opId) return `PREVIEW: swap ${fromBase(amt, from.decimals)} ${from.symbol} → ${to.symbol}\nexpected: ~${expected}\nroute: ${route}\nmax slippage: ${slip}%\nwallet: ${addr.toBase58()}\nShow this to the user; after a clear yes call swap again with the same arguments and confirm: true.`;
  try {
    const sig = await exec!();
    await sql`update wallet_ops set status='done', sig=${sig} where id=${opId}`;
    return `Swapped ${fromBase(amt, from.decimals)} ${from.symbol} → ${to.symbol} (expected ~${expected}).\nsignature ${sig}\n${solscanTx(sig)}`;
  } catch (e: any) { await sql`update wallet_ops set status='failed', error=${String(e.message).slice(0, 300)} where id=${opId}`; throw new UserError(`Swap failed: ${String(e.message).slice(0, 200)}`); }
}
