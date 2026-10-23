// As the agent over REST: withdraw + swap (preview→confirm), external-pay bot order paid from a fresh wallet, auto-detect, reuse rejection, dashboard, stop/resume.
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { conn, launchWallet } from "@/lib/solana"; import { sendSol } from "@/lib/trade/curve";
import fs from "fs";
const B = "https://heyclawlaunch.vercel.app", reg = JSON.parse(fs.readFileSync((process.env.AUDIT_DIR ?? "/workspace/audit2") + "/reg.json", "utf8")), peer = JSON.parse(fs.readFileSync((process.env.AUDIT_DIR ?? "/workspace/audit2") + "/peer.json", "utf8"));
const MINT = JSON.parse(fs.readFileSync((process.env.AUDIT_DIR ?? "/workspace/audit2") + "/launch.json", "utf8")).mint;
const H = { authorization: `Bearer ${reg.api_key}`, "content-type": "application/json" };
const T = (n: string, a: any) => fetch(`${B}/api/v1/tools/${n}`, { method: "POST", headers: H, body: JSON.stringify(a) }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const sh = (x: any) => JSON.stringify(x).replace(/hcla_\w+/g, "hcla_***").replace(/HCL-[A-Z0-9-]+/g, "HCL-***").slice(0, 300);
const log: any[] = []; const rep = (n: string, ok: boolean, d: any) => { log.push({ n, ok, d }); console.log(ok ? "PASS" : "FAIL", n, sh(d)); };
let r = await T("withdraw", { to: peer.wallet_address, amount: "0.001" }); rep("withdraw-preview", r.s === 200 && !/sig|tx [1-9A-HJ-NP-Za-km-z]{60}/.test(r.j.text ?? ""), r.j.text);
r = await T("withdraw", { to: peer.wallet_address, amount: "0.001", confirm: true }); rep("withdraw-confirm", r.s === 200 && /solscan|tx/i.test(r.j.text ?? ""), r.j.text);
r = await T("swap", { to: MINT, amount: "0.01" }); rep("swap-preview", r.s === 200, r.j.text);
r = await T("swap", { to: MINT, amount: "0.01", confirm: true }); rep("swap-buy-confirm", r.s === 200 && /tx|solscan/i.test(r.j.text ?? ""), r.j.text);
// external pay bot order via /api/bots
const o = await fetch(`${B}/api/bots`, { method: "POST", headers: H, body: JSON.stringify({ mint: MINT, kind: "volume", package: "v-02", pay: "external" }) }).then(r => r.json());
const p = o.payment; rep("bot-order-external", !!p?.reference, { to: p?.to, lamports: p?.lamports, order: p?.order_id });
const payer = Keypair.generate(); await sendSol(launchWallet(), payer.publicKey, BigInt(p.lamports) + 10_000_000n);
const ix = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(p.to), lamports: Number(p.lamports) }); ix.keys.push({ pubkey: new PublicKey(p.reference), isSigner: false, isWritable: false });
const sig = await sendAndConfirmTransaction(conn(), new Transaction().add(ix), [payer], { commitment: "confirmed" });
const tx = await conn().getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
rep("pay-onchain", !!tx && !tx.meta?.err, { sig, fee: tx?.meta?.fee });
let st: any; for (let i = 0; i < 8; i++) { st = await fetch(`${B}/api/bots/pay?order=${p.order_id}`, { headers: H }).then(r => r.json()); if (st.status && st.status !== "awaiting_payment" && st.status !== "pending") break; await new Promise(r => setTimeout(r, 5000)); }
rep("pay-detected", /queued|running|paid/.test(JSON.stringify(st)), st);
const o2 = await fetch(`${B}/api/bots`, { method: "POST", headers: H, body: JSON.stringify({ mint: MINT, kind: "volume", package: "v-02", pay: "external" }) }).then(r => r.json());
const reuse = await fetch(`${B}/api/bots/pay`, { method: "POST", headers: H, body: JSON.stringify({ order_id: o2.payment.order_id, tx: sig }) }).then(async r => ({ s: r.status, j: await r.json() }));
rep("reuse-rejected", reuse.s >= 400 || /already|used|reuse/i.test(JSON.stringify(reuse.j)), reuse);
fs.writeFileSync((process.env.AUDIT_DIR ?? "/workspace/audit2") + "/bots.json", JSON.stringify({ order: p.order_id, order2: o2.payment.order_id, sig }));
await new Promise(r => setTimeout(r, 40000));
const d = await fetch(`${B}/api/bots`, { headers: H }).then(r => r.json()); const mine = (d.orders ?? d.mine ?? []).find((x: any) => x.id === p.order_id);
rep("dashboard-lists-order", !!mine, mine && { status: mine.status, volume: mine.volume_sol ?? mine.volume, trades: mine.trades });
let c = await fetch(`${B}/api/bots/control`, { method: "POST", headers: H, body: JSON.stringify({ order_id: p.order_id, action: "stop" }) }).then(r => r.json()); rep("bot-stop", c.status === "paused", c);
c = await fetch(`${B}/api/bots/control`, { method: "POST", headers: H, body: JSON.stringify({ order_id: p.order_id, action: "resume" }) }).then(r => r.json()); rep("bot-resume", c.status === "queued", c);
const anon = await fetch(`${B}/api/bots/control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: p.order_id, action: "stop" }) }); rep("bot-control-anon-rejected", anon.status >= 400, anon.status);
fs.writeFileSync((process.env.AUDIT_DIR ?? "/workspace/audit2") + "/bots-log.json", sh(log)); process.exit(0);
