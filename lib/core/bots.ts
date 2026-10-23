import { friendlyChainError } from "@/lib/solana/errors";
// Volume bots (devnet SOL only): volume, bump, buy, sell, holders. Paid from the user's custodial wallet,
// executed with encrypted per-order bot wallets funded from the launch wallet (keeps a reserve).
import { PublicKey } from "@solana/web3.js";
import { sql } from "@/lib/db";
import { conn, launchWallet } from "@/lib/solana";
import { getOrCreateCustodial, withCustodialSigner } from "@/lib/keystore";
import { buy, sell, sendSol, tokenBalance } from "@/lib/trade/curve";
import { previewGate, need } from "@/lib/core/wallet";
import { UserError } from "@/lib/core/validate";
import { redis, hasRedis } from "@/lib/redis";
import { cfg, solscanTx } from "@/lib/config";
import { listCoins } from "@/lib/core/market";

const SOL = 1_000_000_000n;
const L = (sol: number) => BigInt(Math.round(sol * 1e9));
export type Kind = "volume" | "bump" | "buy" | "sell" | "holders";
export type Pkg = { id: string; name: string; price: bigint; trades: number; volume: bigint; tradeMin: bigint; tradeMax: bigint; capital: bigint; blurb: string };
const TIERS = [0.2, 1, 2, 3, 5]; // devnet SOL
const NAMES = ["Starter", "Growth", "Pro", "Whale", "Mega"];
const mk = (pre: string, f: (sol: number) => Omit<Pkg, "id" | "name" | "price">) => TIERS.map((t, i) => ({ id: `${pre}-${String(t).replace(".", "")}`, name: NAMES[i], price: L(t), ...f(t) }));
export const KINDS: Record<Kind, { title: string; desc: string; pkgs: Pkg[] }> = {
  volume: { title: "Volume bot", desc: "Buy → sell cycles from bot wallets. Builds real on-curve volume without holding the price.", pkgs: mk("v", t => { const vol = t * 5, trades = Math.round(40 * Math.sqrt(t / 0.2)), size = vol / trades; return { trades, volume: L(vol), tradeMin: L(size * 0.8), tradeMax: L(size * 1.2), capital: L(size * 1.2 + 0.01), blurb: `~${vol} SOL volume · ${trades} trades` }; }) },
  bump: { title: "Bump bot", desc: "Tiny buy + sell pairs that keep the coin at the top of “recent trades”.", pkgs: mk("b", t => { const bumps = Math.round(t * 250), size = 0.003; return { trades: bumps * 2, volume: L(bumps * 2 * size), tradeMin: L(0.0025), tradeMax: L(0.0035), capital: L(0.012), blurb: `${bumps} bumps` }; }) },
  buy: { title: "Buy bot", desc: "Steady small buys: net buy pressure, the bot wallets keep the tokens.", pkgs: mk("y", t => { const spend = t * 0.7, trades = Math.round(20 * Math.sqrt(t / 0.2)), size = spend / trades; return { trades, volume: L(spend), tradeMin: L(size * 0.8), tradeMax: L(size * 1.2), capital: L(spend * 1.25 + 0.01), blurb: `${trades} buys · ~${+spend.toFixed(2)} SOL bought` }; }) },
  sell: { title: "Sell bot", desc: "Sells YOUR wallet's bag in even slices (TWAP) instead of one dump. Proceeds land in your wallet.", pkgs: mk("s", t => ({ trades: Math.round(t * 40) + 2, volume: 0n, tradeMin: 0n, tradeMax: 0n, capital: 0n, blurb: `sell your bag in ${Math.round(t * 40) + 2} slices` })) },
  holders: { title: "Holder booster", desc: "New wallets each buy a small amount and hold it: the holder count goes up.", pkgs: mk("h", t => { const n = Math.round(t * 120); return { trades: n, volume: L(n * 0.001), tradeMin: L(0.001), tradeMax: L(0.001), capital: L(0.007), blurb: `+${n} real holders` }; }) },
};
export const RESERVE = BigInt(Math.round(Number(process.env.BOT_RESERVE_SOL ?? "1") * 1e9)); // launch wallet never goes below this for bots
const MAX_ACTIVE = 4;
/** Capital still owed to active orders (package working capital minus what was already moved to their bot wallets). */
async function committedCapital() {
  const rows = await sql`select o.kind, o.package, coalesce((select sum(case when t.side='fund' then t.lamports when t.side='sweep' then -t.lamports else 0 end) from bot_txs t where t.order_id=o.id and t.ok),0)::text net from bot_orders o where o.status in ('queued','running')`;
  let c = 0n; for (const r of rows) { const k = KINDS[r.kind as Kind]?.pkgs.find(x => x.id === r.package); if (!k) continue; const out = BigInt(r.net); if (k.capital > out) c += k.capital - (out > 0n ? out : 0n); }
  return c;
}
/** Refuse only if, after this order's payment arrives, the platform wallet can't cover this order's working capital plus every active order's outstanding capital on top of the reserve. */
async function checkCapacity(p: Pkg) {
  const lw = BigInt(await conn().getBalance(launchWallet().publicKey)); const committed = await committedCapital();
  const free = lw + p.price - committed - RESERVE;
  if (free < p.capital) throw new UserError(`Bot capacity is full right now: this ${p.name} package needs ${fmt(p.capital)} SOL of working capital, but the platform bot wallet only has ${fmt(free > 0n ? free : 0n)} SOL free (balance ${fmt(lw)} SOL, ${fmt(committed)} SOL committed to running bots, ${fmt(RESERVE)} SOL reserve). You were not charged. Try a smaller package, or again in a few minutes when running bots finish.`);
}
export const findPkg = (kind: string, id: string) => { const k = KINDS[kind as Kind]; const p = k?.pkgs.find(p => p.id === id); if (!p) throw new UserError(`Unknown package ${id} for ${kind}. Options: ${k ? k.pkgs.map(p => p.id).join(", ") : Object.keys(KINDS).join(", ")}`); return p; };
const fmt = (l: bigint | number) => (Number(l) / 1e9).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");

export async function botMarkets(filter: "new" | "graduating" | "graduated" | "all" = "all", limit = 30) {
  const rows = (await listCoins({ limit: 80 })).filter(c => c.pair === "SOL");
  const out = [];
  for (const r of rows) {
    const progress = r.progress, complete = r.complete;
    const st = complete ? "graduated" : progress >= 50 ? "graduating" : "new";
    if (filter !== "all" && st !== filter) continue;
    out.push({ mint: r.mint, name: r.name, ticker: r.ticker, logo_cid: r.logo_cid, launched_at: r.launched_at, progress, complete, status: st, mcap: r.mcapQuote, mcap_usd: r.mcapUsd ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

/** Preview → confirm. On confirm, pays the package price from the user's custodial wallet to the launch wallet and queues the order. */
export async function orderBot(ctx: any, a: { mint: string; kind: string; package: string; confirm?: boolean; pay?: string }) {
  if (a.pay === "external") return orderBotExternal(ctx, a);
  const key = need(ctx); const p = findPkg(a.kind, a.package); const kind = a.kind as Kind;
  let mint: PublicKey; try { mint = new PublicKey(a.mint); } catch { throw new UserError("That isn't a valid mint address."); }
  const [coin] = await sql`select name, ticker, owner_key, quote_mint from launches where mint=${mint.toBase58()}`;
  if (!coin) throw new UserError(`Volume bots only run on coins launched on ${cfg.brand}.`);
  if (coin.quote_mint && coin.quote_mint !== "So11111111111111111111111111111111111111112") throw new UserError("Bots run on SOL-pair coins only.");
  /* graduated coins trade on their PumpSwap pool (lib/trade/curve.ts routes automatically) */
  const wallet = new PublicKey(await getOrCreateCustodial(key)); const bal = BigInt(await conn().getBalance(wallet));
  if (kind === "sell") { const tb = await tokenBalance(wallet, mint); if (tb === 0n) throw new UserError(`Your wallet holds no $${coin.ticker} to sell.`); }
  await checkCapacity(p);
  const [{ n }] = await sql`select count(*)::int n from bot_orders where status in ('queued','running')`; if (n >= MAX_ACTIVE) throw new UserError("All bot slots are busy. Try again in a few minutes.");
  const preview = `PREVIEW: ${KINDS[kind].title} · ${p.name} on $${coin.ticker} (${coin.name})\n${p.blurb}\nprice: ${fmt(p.price)} devnet SOL from your wallet ${wallet.toBase58()} (balance ${fmt(bal)})\n${p.volume ? `target volume: ~${fmt(p.volume)} SOL · ` : ""}${p.trades} ${kind === "holders" ? "new holders" : "trades"}\nruns on: pump.fun bonding curve (${cfg.cluster}), real transactions`;
  if (bal < p.price + 5_000_000n) throw new UserError(`${preview}\n\nNot enough SOL: you need ${fmt(p.price + 5_000_000n)} SOL (price + fees). Fund your wallet, or pay from any wallet: call again with pay: \"external\" to get a deposit address, exact amount and a unique reference.`);
  const opId = await previewGate(key, "bot", { mint: mint.toBase58(), kind, pkg: p.id }, a.confirm);
  if (!opId) return { text: `${preview}\nConfirm to pay and start.`, preview: true };
  const paySig = await withCustodialSigner(key, kp => sendSol(kp, launchWallet().publicKey, p.price));
  const [o] = await sql`insert into bot_orders(owner_key,mint,kind,package,price_lamports,target_volume_lamports,max_trades,status,pay_sig) values(${key},${mint.toBase58()},${kind},${p.id},${p.price.toString()},${p.volume.toString()},${p.trades},'queued',${paySig}) returning id`;
  await sql`update wallet_ops set status='done', sig=${paySig} where id=${opId}`;
  return { text: `Started ${KINDS[kind].title} · ${p.name} on $${coin.ticker}. Paid ${fmt(p.price)} SOL: ${solscanTx(paySig)}\norder ${o.id}. Watch the live feed on the Volume Bots tab.`, orderId: o.id, paySig };
}

const rnd = (a: bigint, b: bigint) => a + BigInt(Math.floor(Math.random() * Number(b - a + 1n)));
async function log(o: any, side: string, lamports: bigint, wallet: string, sig: string | null, err?: string) {
  await sql`insert into bot_txs(order_id,mint,side,lamports,wallet,sig,ok,error) values(${o.id},${o.mint},${side},${lamports.toString()},${wallet},${sig},${!err},${err ?? null})`;
  if (hasRedis()) await redis().lpush("hcl:bots:feed", JSON.stringify({ order: o.id, kind: o.kind, mint: o.mint, side, sol: Number(lamports) / 1e9, sig, ok: !err, ts: Date.now() })).then(() => redis().ltrim("hcl:bots:feed", 0, 99)).catch(() => {});
}
const VOL_WALLETS = 4; // volume/bump bot wallets per order
const botKey = (o: any, i = 0) => `bot:${o.id}:${i}`;
async function fund(o: any, i: number, lamports: bigint) {
  const pk = new PublicKey(await getOrCreateCustodial(botKey(o, i)));
  const have = BigInt(await conn().getBalance(pk)); if (have >= lamports) return pk;
  const lw = BigInt(await conn().getBalance(launchWallet().publicKey)); if (lw - (lamports - have) < RESERVE) throw new Error(`platform reserve reached (platform wallet ${fmt(lw)} SOL, reserve ${fmt(RESERVE)} SOL)`);
  const sig = await sendSol(launchWallet(), pk, lamports - have); await log(o, "fund", lamports - have, pk.toBase58(), sig); return pk;
}
async function sweep(o: any, i: number, sellFirst: boolean) {
  const k = botKey(o, i); const pk = new PublicKey(await getOrCreateCustodial(k)); const mint = new PublicKey(o.mint);
  if (sellFirst && (await tokenBalance(pk, mint)) > 0n) { try { const r = await withCustodialSigner(k, kp => sell(kp, mint)); await log(o, "sell", r.lamports, pk.toBase58(), r.sig); } catch (e: any) { await log(o, "sell", 0n, pk.toBase58(), null, e.message); } }
  const bal = BigInt(await conn().getBalance(pk)); const fee = 5000n;
  if (bal > fee) { const sig = await withCustodialSigner(k, kp => sendSol(kp, launchWallet().publicKey, bal - fee)); await log(o, "sweep", bal - fee, pk.toBase58(), sig); }
}
/** One step for every running order. Call from the worker every few seconds. */
export async function botTickOnce() {
  await sql`update bot_orders set status='running', updated_at=now() where status='queued'`;
  const orders = await sql`select * from bot_orders where status='running' order by created_at limit ${MAX_ACTIVE}`;
  const done: string[] = [];
  for (const o of orders) {
    let p: Pkg; try { p = findPkg(o.kind, o.package); } catch (e: any) { await sql`update bot_orders set status='stopped', error=${e.message} where id=${o.id}`; continue; }
    const mint = new PublicKey(o.mint);
    try {
      const finished = o.trades >= o.max_trades || (p.volume > 0n && BigInt(o.done_volume_lamports) >= p.volume && o.kind !== "holders");
      if (finished) {
        if (o.kind === "volume" || o.kind === "bump") for (let i = 0; i < VOL_WALLETS; i++) await sweep(o, i, false); // SOL back to the platform; the small token holdings stay
        if (o.kind === "buy") await sweep(o, 0, false);
        await sql`update bot_orders set status='done', updated_at=now() where id=${o.id}`; done.push(o.id); continue;
      }
      let vol = 0n;
      if (o.kind === "volume" || o.kind === "bump") {
        // Rotate buy→sell cycles across VOL_WALLETS bot wallets; each sell keeps a small slice (5–15%) so every wallet that traded stays a real holder.
        const wi = Math.floor(o.trades / 2) % VOL_WALLETS; const pk = await fund(o, wi, p.capital); const k = botKey(o, wi); const tb = await tokenBalance(pk, mint);
        if (o.trades % 2 === 1 && tb > 0n) { const keep = BigInt(5 + Math.floor(Math.random() * 11)); const amt = tb - (tb * keep) / 100n; const r = await withCustodialSigner(k, kp => sell(kp, mint, amt > 0n ? amt : tb)); vol = r.lamports; await log(o, "sell", r.lamports, pk.toBase58(), r.sig); }
        else { const amt = rnd(p.tradeMin, p.tradeMax); const r = await withCustodialSigner(k, kp => buy(kp, mint, amt)); vol = amt; await log(o, "buy", amt, pk.toBase58(), r.sig); }
      } else if (o.kind === "buy") {
        const pk = await fund(o, 0, p.capital); const amt = rnd(p.tradeMin, p.tradeMax);
        const r = await withCustodialSigner(botKey(o, 0), kp => buy(kp, mint, amt)); vol = amt; await log(o, "buy", amt, pk.toBase58(), r.sig);
      } else if (o.kind === "holders") {
        const i = o.trades + 1; const pk = await fund(o, i, 7_000_000n); // ATA rent + pump volume-accumulator rent + buy + fees; payer must stay rent-exempt
        const r = await withCustodialSigner(botKey(o, i), kp => buy(kp, mint, p.tradeMin)); vol = p.tradeMin; await log(o, "buy", p.tradeMin, pk.toBase58(), r.sig);
        const left = BigInt(await conn().getBalance(pk)); if (left > 10_000n) { const s = await withCustodialSigner(botKey(o, i), kp => sendSol(kp, launchWallet().publicKey, left - 5000n)).catch(() => null); if (s) await log(o, "sweep", left - 5000n, pk.toBase58(), s); }
      } else if (o.kind === "sell") {
        const wallet = new PublicKey(await getOrCreateCustodial(o.owner_key)); const tb = await tokenBalance(wallet, mint);
        if (tb === 0n) { await sql`update bot_orders set status='done', updated_at=now() where id=${o.id}`; done.push(o.id); continue; }
        const slices = Math.max(1, o.max_trades - o.trades); const amt = slices === 1 ? tb : tb / BigInt(slices);
        const r = await withCustodialSigner(o.owner_key, kp => sell(kp, mint, amt)); vol = r.lamports; await log(o, "sell", r.lamports, wallet.toBase58(), r.sig);
      }
      await sql`update bot_orders set trades=trades+1, done_volume_lamports=done_volume_lamports+${vol.toString()}, updated_at=now(), error=null where id=${o.id}`;
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 300); await log(o, "error", 0n, "", null, msg);
      const fatal = /graduated|reserve/.test(msg);
      await sql`update bot_orders set error=${friendlyChainError(msg)}, status=${fatal ? "stopped" : "running"}, updated_at=now() where id=${o.id}`;
      if (fatal) { try { await sweep(o, 0, o.kind !== "buy"); } catch {} }
    }
  }
  return { ran: orders.length, done };
}
export async function botFeed(limit = 40, mint?: string) {
  return mint ? sql`select * from bot_txs where mint=${mint} order by ts desc limit ${limit}` : sql`select t.*, l.ticker from bot_txs t left join launches l on l.mint=t.mint order by t.ts desc limit ${limit}`;
}
export async function myBotOrders(ownerKey: string) { return sql`select o.*, l.ticker, l.name from bot_orders o left join launches l on l.mint=o.mint where o.owner_key=${ownerKey} order by o.created_at desc limit 20`; }
export const _SOL = SOL;

// ---------- Pay from any wallet: deposit address + exact amount + unique reference (Solana Pay style), verified on chain ----------
const PAY_TTL_MIN = 30;
export async function orderBotExternal(ctx: any, a: { mint: string; kind: string; package: string }) {
  const owner = ctx.walletKey ?? ctx.ownerKey; const p = findPkg(a.kind, a.package); const kind = a.kind as Kind;
  if (kind === "sell") throw new UserError("Sell bots sell tokens from your own wallet, so they need your HeyClawLaunch wallet. Pick another bot.");
  let mint: PublicKey; try { mint = new PublicKey(a.mint); } catch { throw new UserError("That isn't a valid mint address."); }
  const [coin] = await sql`select name, ticker, quote_mint from launches where mint=${mint.toBase58()}`;
  if (!coin) throw new UserError(`Volume bots only run on coins launched on ${cfg.brand}.`);
  /* graduated coins trade on their PumpSwap pool (lib/trade/curve.ts routes automatically) */
  await checkCapacity(p);
  const ref = (await import("@solana/web3.js")).Keypair.generate().publicKey.toBase58(); const to = launchWallet().publicKey.toBase58();
  const [o] = await sql`insert into bot_orders(owner_key,mint,kind,package,price_lamports,target_volume_lamports,max_trades,status,pay_ref,pay_to,pay_expires_at) values(${owner},${mint.toBase58()},${kind},${p.id},${p.price.toString()},${p.volume.toString()},${p.trades},'awaiting_payment',${ref},${to},now() + make_interval(mins => ${PAY_TTL_MIN})) returning id`;
  const amount = Number(p.price) / 1e9;
  const url = `solana:${to}?amount=${amount}&reference=${ref}&label=${encodeURIComponent(cfg.brand)}&message=${encodeURIComponent(`${p.name} bot on $${coin.ticker}`)}`;
  return { text: `PAY FROM ANY WALLET (${cfg.cluster})\n${KINDS[kind].title} · ${p.name} on $${coin.ticker}\nsend exactly: ${amount} SOL\nto: ${to}\nreference: ${ref} (add it as a read-only account key; Solana Pay links and our Phantom button do this)\nSolana Pay: ${url}\nexpires in ${PAY_TTL_MIN} min · order ${o.id}\nAfter paying, send the tx hash or Solscan link (bot_payment with order_id + tx), or wait: we detect the payment by its reference and start the bot automatically.\nTrack it: ${cfg.appUrl}/dashboard`, orderId: o.id, payment: { order_id: o.id, to, amount_sol: amount, lamports: p.price.toString(), reference: ref, solana_pay_url: url, expires_in_min: PAY_TTL_MIN } };
}
/** Verifies an external payment (given tx, or auto-detected via the reference) and starts the bot. Idempotent. */
export async function verifyBotPayment(orderId: string, tx?: string) {
  const [o] = await sql`select * from bot_orders where id=${orderId}`;
  if (!o || !o.pay_ref) throw new UserError("Unknown order.", 404);
  if (o.status !== "awaiting_payment") return { status: o.status, pay_sig: o.pay_sig, text: o.pay_sig ? `Already paid: ${solscanTx(o.pay_sig)}` : `Order is ${o.status}.` };
  let sigs: string[] = [];
  if (tx) { const m = String(tx).match(/[1-9A-HJ-NP-Za-km-z]{80,90}/); if (!m) throw new UserError("Paste a transaction signature or a Solscan tx link."); sigs = [m[0]]; }
  else sigs = (await conn().getSignaturesForAddress(new PublicKey(o.pay_ref), { limit: 10 })).filter(x => !x.err).map(x => x.signature);
  if (!sigs.length) { if (new Date(o.pay_expires_at) < new Date()) await sql`update bot_orders set status='expired' where id=${o.id} and status='awaiting_payment'`; return { status: new Date(o.pay_expires_at) < new Date() ? "expired" : "awaiting_payment", text: "No payment found yet." }; }
  let lastErr = "";
  for (const sig of sigs) {
    const t = await conn().getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (!t) { lastErr = "Transaction not found or not confirmed yet."; continue; }
    if (t.meta?.err) { lastErr = "That transaction failed on chain."; continue; }
    const keys = t.transaction.message.accountKeys.map((k: any) => (k.pubkey ?? k).toBase58());
    if (!keys.includes(o.pay_ref)) { lastErr = "That transaction doesn't carry this order's reference."; continue; }
    const paid = t.transaction.message.instructions.filter((i: any) => i.program === "system" && i.parsed?.type === "transfer" && i.parsed.info.destination === o.pay_to).reduce((s: number, i: any) => s + Number(i.parsed.info.lamports), 0);
    if (BigInt(paid) < BigInt(o.price_lamports)) { lastErr = `Paid ${paid / 1e9} SOL, need ${Number(o.price_lamports) / 1e9} SOL.`; continue; }
    const [used] = await sql`select id from bot_orders where pay_sig=${sig}`; if (used) { lastErr = "That transaction was already used for another order."; continue; }
    const [u] = await sql`update bot_orders set status='queued', pay_sig=${sig}, updated_at=now() where id=${o.id} and status='awaiting_payment' returning id`;
    if (u) return { status: "queued", pay_sig: sig, text: `Payment verified (${solscanTx(sig)}). The bot starts within seconds. Track it at ${cfg.appUrl}/dashboard` };
  }
  throw new UserError(lastErr || "Payment not valid.");
}
