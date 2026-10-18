// E2E: order a bot with pay "external", pay from an outside wallet with the reference attached, verify, bot starts. Also checks reuse rejection.
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { orderBot, verifyBotPayment } from "@/lib/core/bots";
import { conn, launchWallet } from "@/lib/solana"; import { sendSol } from "@/lib/trade/curve"; import { sql } from "@/lib/db";
const MINT = process.argv[2] ?? "87TouEG5NLr1qKgxEMw1YEePNCCqSXaq3W6vor5jQ66v";
(async () => {
  const k = `test:ext-${Date.now()}`; const r: any = await orderBot({ ownerKey: k, surface: "test" }, { mint: MINT, kind: "volume", package: "v-02", pay: "external" });
  console.log(r.text.split("\n").slice(0, 4).join(" | ")); const p = r.payment;
  const payer = Keypair.generate(); console.log("fund payer", await sendSol(launchWallet(), payer.publicKey, BigInt(p.lamports) + 10_000_000n));
  const ix = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(p.to), lamports: Number(p.lamports) }); ix.keys.push({ pubkey: new PublicKey(p.reference), isSigner: false, isWritable: false });
  const sig = await sendAndConfirmTransaction(conn(), new Transaction().add(ix), [payer], { commitment: "confirmed" }); console.log("PAY", sig);
  const v = await verifyBotPayment(p.order_id); console.log("AUTO-DETECT", v.status, v.text);
  const r2: any = await orderBot({ ownerKey: k, surface: "test" }, { mint: MINT, kind: "volume", package: "v-02", pay: "external" });
  try { await verifyBotPayment(r2.payment.order_id, sig); console.log("REUSE FAIL (accepted)"); } catch (e: any) { console.log("REUSE rejected:", e.message); }
  await sql`update bot_orders set status='expired' where id=${r2.payment.order_id}`;
  console.log("ORDER", p.order_id); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
