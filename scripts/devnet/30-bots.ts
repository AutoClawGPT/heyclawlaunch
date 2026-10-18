// E2E: fund a test user's custodial wallet, preview + confirm a bump bot order, let the worker run it, print tx sigs.
import { PublicKey } from "@solana/web3.js";
import { botMarkets, orderBot } from "@/lib/core/bots";
import { getOrCreateCustodial } from "@/lib/keystore";
import { conn, launchWallet } from "@/lib/solana";
import { sendSol } from "@/lib/trade/curve";
import { sql } from "@/lib/db";
const kind = process.argv[2] ?? "volume", pkg = process.argv[3] ?? "v-02";
const ctx: any = { ownerKey: "tg:900000001", walletKey: "tg:900000001", surface: "test" };
const m = (await botMarkets("new", 50)).find(x => x.progress < 40)!; console.log("| coin |", m.name, m.mint, m.progress.toFixed(2) + "%");
const w = new PublicKey(await getOrCreateCustodial(ctx.walletKey));
if ((await conn().getBalance(w)) < 230_000_000) console.log("| fund |", await sendSol(launchWallet(), w, 250_000_000n));
const p = await orderBot(ctx, { mint: m.mint, kind, package: pkg }); console.log("| preview |", p.text.replace(/\n/g, " / "));
const c = await orderBot(ctx, { mint: m.mint, kind, package: pkg, confirm: true }); console.log("| confirm |", c.text.replace(/\n/g, " / "));
const id = (c as any).orderId; const t0 = Date.now();
while (Date.now() - t0 < 600_000) { const [o] = await sql`select status, trades, max_trades, done_volume_lamports, error from bot_orders where id=${id}`; if (["done", "stopped"].includes(o.status)) { console.log("| order |", o); break; } await new Promise(r => setTimeout(r, 5000)); }
const txs = await sql`select side, lamports, sig, ok, error from bot_txs where order_id=${id} order by id`;
for (const t of txs) console.log("| tx |", t.side, Number(t.lamports) / 1e9, t.ok ? `https://solscan.io/tx/${t.sig}?cluster=devnet` : t.error);
process.exit(0);
