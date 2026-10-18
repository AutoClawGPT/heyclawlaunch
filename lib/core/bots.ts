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
import { coinInfo } from "@/lib/core/coin";
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
  holders: { title: "Holder booster", desc: "New wallets each buy a small amount and hold it: the holder count goes up.", pkgs: mk("h", t => { const n = Math.round(t * 120); return { trades: n, volume: L(n * 0.001), tradeMin: L(0.001), tradeMax: L(0.001), capital: L(0.004), blurb: `+${n} real holders` }; }) },
};
export const RESERVE = BigInt(Math.round(Number(process.env.BOT_RESERVE_SOL ?? "1") * 1e9)); // launch wallet never goes below this for bots
const MAX_ACTIVE = 4;
export const findPkg = (kind: string, id: string) => { const k = KINDS[kind as Kind]; const p = k?.pkgs.find(p => p.id === id); if (!p) throw new UserError(`Unknown package ${id} for ${kind}. Options: ${k ? k.pkgs.map(p => p.id).join(", ") : Object.keys(KINDS).join(", ")}`); return p; };
const fmt = (l: bigint | number) => (Number(l) / 1e9).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");

export async function botMarkets(filter: "new" | "graduating" | "graduated" | "all" = "all", limit = 30) {
  const rows = (await listCoins({ limit: 80 })).filter(c => c.pair === "SOL");
  const out = [];
  for (const r of rows) {
    const progress = r.progress, complete = r.complete;
    const st = complete ? "graduated" : progress >= 50 ? "graduating" : "new";
    if (filter !== "all" && st !== filter) continue;
    out.push({ mint: r.mint, name: r.name, ticker: r.ticker, logo_cid: r.logo_cid, launched_at: r.launched_at, progress, complete, status: st, mcap: r.mcapQuote });
    if (out.length >= limit) break;
  }
  return out;
}

/** Preview → confirm. On confirm, pays the package price from the user's custodial wallet to the launch wallet and queues the order. */
export async function orderBot(ctx: any, a: { mint: string; kind: string; package: string; confirm?: boolean }) {
  const key = need(ctx); const p = findPkg(a.kind, a.package); const kind = a.kind as Kind;
  let mint: PublicKey; try { mint = new PublicKey(a.mint); } catch { throw new UserError("That isn't a valid mint address."); }
  const [coin] = await sql`select name, ticker, owner_key, quote_mint from launches where mint=${mint.toBase58()}`;
  if (!coin) throw new UserError(`Volume bots only run on coins launched on ${cfg.brand}.`);
  if (coin.quote_mint && coin.quote_mint !== "So11111111111111111111111111111111111111112") throw new UserError("Bots run on SOL-pair coins only.");
  const ci: any = await coinInfo(mint.toBase58()).catch(() => null); if (ci?.curve?.complete) throw new UserError("This coin graduated off the bonding curve; bots run on curve coins.");
  const wallet = new PublicKey(await getOrCreateCustodial(key)); const bal = BigInt(await conn().getBalance(wallet));
  if (kind === "sell") { const tb = await tokenBalance(wallet, mint); if (tb === 0n) throw new UserError(`Your wallet holds no $${coin.ticker} to sell.`); }
  const lw = BigInt(await conn().getBalance(launchWallet().publicKey));
  if (lw + p.price - p.capital < RESERVE) throw new UserError("Bot capacity is used up right now (the platform wallet is at its reserve). Try again later.");
  const [{ n }] = await sql`select count(*)::int n from bot_orders where status in ('queued','running')`; if (n >= MAX_ACTIVE) throw new UserError("All bot slots are busy. Try again in a few minutes.");
  const preview = `PREVIEW: ${KINDS[kind].title} · ${p.name} on $${coin.ticker} (${coin.name})\n${p.blurb}\nprice: ${fmt(p.price)} devnet SOL from your wallet ${wallet.toBase58()} (balance ${fmt(bal)})\n${p.volume ? `target volume: ~${fmt(p.volume)} SOL · ` : ""}${p.trades} ${kind === "holders" ? "new holders" : "trades"}\nruns on: pump.fun bonding curve (${cfg.cluster}), real transactions`;
  if (bal < p.price + 5_000_000n) throw new UserError(`${preview}\n\nNot enough SOL: you need ${fmt(p.price + 5_000_000n)} SOL (price + fees). Fund your wallet first.`);
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
const botKey = (o: any, i = 0) => `bot:${o.id}:${i}`;
async function fund(o: any, i: number, lamports: bigint) {
  const pk = new PublicKey(await getOrCreateCustodial(botKey(o, i)));
  const have = BigInt(await conn().getBalance(pk)); if (have >= lamports) return pk;
  const lw = BigInt(await conn().getBalance(launchWallet().publicKey)); if (lw - (lamports - have) < RESERVE) throw new Error("platform reserve reached");
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
        if (o.kind === "volume" || o.kind === "bump") await sweep(o, 0, true);
        if (o.kind === "buy") await sweep(o, 0, false);
        await sql`update bot_orders set status='done', updated_at=now() where id=${o.id}`; done.push(o.id); continue;
      }
      let vol = 0n;
      if (o.kind === "volume" || o.kind === "bump") {
        const pk = await fund(o, 0, p.capital); const k = botKey(o, 0);
        if ((await tokenBalance(pk, mint)) > 0n) { const r = await withCustodialSigner(k, kp => sell(kp, mint)); vol = r.lamports; await log(o, "sell", r.lamports, pk.toBase58(), r.sig); }
        else { const amt = rnd(p.tradeMin, p.tradeMax); const r = await withCustodialSigner(k, kp => buy(kp, mint, amt)); vol = amt; await log(o, "buy", amt, pk.toBase58(), r.sig); }
      } else if (o.kind === "buy") {
        const pk = await fund(o, 0, p.capital); const amt = rnd(p.tradeMin, p.tradeMax);
        const r = await withCustodialSigner(botKey(o, 0), kp => buy(kp, mint, amt)); vol = amt; await log(o, "buy", amt, pk.toBase58(), r.sig);
      } else if (o.kind === "holders") {
        const i = o.trades + 1; const pk = await fund(o, i, 4_000_000n); // ATA rent + buy + fees
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
      await sql`update bot_orders set error=${msg}, status=${fatal ? "stopped" : "running"}, updated_at=now() where id=${o.id}`;
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
