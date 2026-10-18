// E2E for several distinct users (2 simulated Telegram users + 1 web/SIWS user) on devnet.
import { Keypair, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import nacl from "tweetnacl";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { conn, launchWallet, sendV0, online } from "@/lib/solana";
import { PUMP_SDK, getBuyV3TokenAmountFromQuoteAmount } from "@/lib/solana/pump";
import { tgCtx } from "@/lib/bots/telegram";
import { ctxForUser, type Ctx } from "@/lib/core/ctx";
import { runTool } from "@/lib/tools/run";
import { createPending, executePending } from "@/lib/brain/agent";
import { withCustodialSigner } from "@/lib/keystore";
import { userFromSessionToken } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { report, PNG1 } from "./lib";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
const c = conn(), launch = launchWallet(), sdk = online();
const sigs = (t: string) => [...t.matchAll(/solscan\.io\/tx\/([1-9A-HJ-NP-Za-km-z]{60,90})/g)].map(m => m[1]);

async function siwsUser(): Promise<Ctx> {
  const kp = Keypair.generate();
  const input = await fetch(`${BASE}/api/siws/input`).then(r => r.json());
  const text = await fetch(`${BASE}/api/siws/input`, { method: "POST", body: JSON.stringify({ ...input, address: kp.publicKey.toBase58() }) }).then(r => r.text());
  const msg = new TextEncoder().encode(text);
  const r = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: kp.publicKey.toBase58(), signedMessage: Buffer.from(msg).toString("base64"), signature: Buffer.from(nacl.sign.detached(msg, kp.secretKey)).toString("base64") }) });
  const tok = /hg_session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")?.[1];
  const u = await userFromSessionToken(tok); if (!u) throw new Error(`siws failed ${r.status}`);
  console.log("web user", u.id, "signed in with", kp.publicKey.toBase58());
  return ctxForUser(u, "web");
}
async function trade(mint: PublicKey) {
  const buyer = Keypair.generate();
  await sendV0([SystemProgram.transfer({ fromPubkey: launch.publicKey, toPubkey: buyer.publicKey, lamports: 0.3 * LAMPORTS_PER_SOL })], [launch]);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig()]);
  const st = await sdk.fetchBuyState(mint, buyer.publicKey, TOKEN_2022_PROGRAM_ID);
  const quoteAmount = new BN(0.25 * LAMPORTS_PER_SOL);
  const amount = getBuyV3TokenAmountFromQuoteAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: st.bondingCurve, amount: quoteAmount, curveBaseTokenBalance: st.curveBaseTokenBalance });
  const b = await sendV0(await PUMP_SDK.buyExactQuoteInV3Instructions({ bondingCurve: st.bondingCurve, associatedUserAccountInfo: st.associatedUserAccountInfo, mint, user: buyer.publicKey, amount, quoteAmount, slippage: 5, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: st.quoteTokenProgram }), [buyer]);
  const bal = new BN((await c.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, buyer.publicKey, true, TOKEN_2022_PROGRAM_ID))).value.amount);
  const ss = await sdk.fetchSellState(mint, buyer.publicKey, TOKEN_2022_PROGRAM_ID);
  const s = await sendV0(await PUMP_SDK.sellV3Instructions({ bondingCurve: ss.bondingCurve, mint, user: buyer.publicKey, amount: bal.divn(2), quoteAmount: new BN(1), slippage: 99, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: ss.quoteTokenProgram }), [buyer]);
  return { b, s };
}
async function txDelta(sig: string, addrs: string[]) {
  const tx = await c.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  const keys = tx!.transaction.message.getAccountKeys({ accountKeysFromLookups: tx!.meta!.loadedAddresses }).keySegments().flat().map(k => k.toBase58());
  return addrs.map(a => { const i = keys.indexOf(a); return i < 0 ? 0 : tx!.meta!.postBalances[i] - tx!.meta!.preBalances[i]; });
}

const users: [string, Ctx][] = [["tgA", await tgCtx(7000000000 + Math.floor(Math.random() * 1e6))], ["tgB", await tgCtx(7100000000 + Math.floor(Math.random() * 1e6))], ["web", await siwsUser()]];
const summary: any[] = [];
for (const [label, ctx] of users) {
  const out: any = { label, owner: ctx.ownerKey };
  try {
    // 1. per-user custodial wallet (created on first use, encrypted at rest)
    const w = (await runTool(ctx, "my_wallet", {})).text; const C = /wallet: ([1-9A-HJ-NP-Za-km-z]{32,44})/.exec(w)![1]; out.custodial = C;
    const [row] = await sql`select pubkey, length(ciphertext) clen, length(wrapped_dek) wlen, key_version from custodial_wallets where owner_key=${ctx.walletKey}`;
    const decryptOk = await withCustodialSigner(ctx.walletKey!, async kp => kp.publicKey.toBase58() === C);
    const plaintextLeak = (await sql`select count(*)::int n from custodial_wallets where owner_key=${ctx.walletKey} and position(${C}::bytea in ciphertext) > 0`)[0].n;
    out.keystore = { stored: row.pubkey === C, ciphertextBytes: row.clen, wrappedDekBytes: row.wlen, decryptsToSamePubkey: decryptOk, plaintextLeak };
    // 2. launch with 80% of fees to the user's own custodial wallet
    const tick = (label.toUpperCase() + Math.floor(Math.random() * 99)).slice(0, 8);
    const p = await runTool(ctx, "prepare_launch", { start_new: true, name: `${label} user coin`, ticker: tick, logo_image: `data:image/png;base64,${PNG1.toString("base64")}`, fee_mode: "wallet", fee_wallet: C, pair: "SOL", description: `multi-user e2e ${label}`, skip_socials: true });
    const draftId = (p.data as any)?.draft_id ?? /draft[_ ]id[:= ]+([0-9a-f-]{36})/i.exec(p.text)?.[1];
    const pend = await createPending(ctx, "confirm_launch", { draft_id: draftId });
    if (label === "tgB") { const other = await executePending(users[0][1], pend.id); out.crossUserConfirmRejected = "error" in other; }
    const r = await executePending(ctx, pend.id); if ("error" in r) throw new Error(r.error);
    const [l] = await sql`select * from launches where draft_id=${draftId}`; if (!l) throw new Error("launch failed: " + r.out.text.slice(0, 300));
    out.mint = l.mint; out.create = l.create_sig; out.split = l.split_sig; out.recipient = l.recipient;
    const mint = new PublicKey(l.mint);
    const shares = (await (await import("@/lib/solana")).readSharingConfig(mint))?.shareholders.map((s: any) => `${s.address.toBase58()}:${s.shareBps}`);
    out.shares = shares;
    // 3. trading generates creator fees
    const t = await trade(mint); out.buy = t.b; out.sell = t.s;
    // 4. claim_fees (confirmation-gated) -> 80% to custodial, 20% to launch wallet
    const cp = await createPending(ctx, "claim_fees", {}); const cr = await executePending(ctx, cp.id); if ("error" in cr) throw new Error(cr.error);
    out.claimText = cr.out.text.split("\n").slice(0, 3).join(" | "); const cs = sigs(cr.out.text); out.claim = cs[0];
    if (cs[0]) { const [dc, dl] = await txDelta(cs[0], [C, launch.publicKey.toBase58()]); out.claimDeltaCustodial = dc; out.claimDeltaLaunchNet = dl; }
    // 5. withdraw preview -> confirm, to a fresh external address
    const dest = Keypair.generate().publicKey.toBase58(); out.withdrawTo = dest;
    const prev = await runTool(ctx, "withdraw", { to: dest, amount: "all", token: "SOL" }); out.preview = prev.text.split("\n")[0];
    const wp = await createPending(ctx, "withdraw", { to: dest, amount: "all", token: "SOL" }); const wr = await executePending(ctx, wp.id); if ("error" in wr) throw new Error(wr.error);
    out.withdraw = sigs(wr.out.text)[0]; out.destBalance = await c.getBalance(new PublicKey(dest));
    out.pass = !!(out.split && out.claim && out.claimDeltaCustodial > 0 && out.destBalance > 0 && decryptOk && !plaintextLeak && shares?.some((s: string) => s === `${C}:8000`) && shares?.some((s: string) => s === `${launch.publicKey.toBase58()}:2000`));
  } catch (e: any) { out.error = String(e.message ?? e).slice(0, 400); out.pass = false; }
  console.log(JSON.stringify(out, null, 1)); summary.push(out);
  report(`20-multiuser-${label}`, out.pass, `owner ${out.owner} custodial ${out.custodial} mint ${out.mint} create ${out.create} split ${out.split} shares ${out.shares} buy ${out.buy} sell ${out.sell} claim ${out.claim} (+${out.claimDeltaCustodial} lamports to custodial, launch net ${out.claimDeltaLaunchNet}) withdraw ${out.withdraw} -> ${out.withdrawTo} (${out.destBalance} lamports) keystore ${JSON.stringify(out.keystore)}${out.crossUserConfirmRejected !== undefined ? ` crossUserConfirmRejected=${out.crossUserConfirmRejected}` : ""}${out.error ? " ERROR " + out.error : ""}`);
}
const custodials = new Set(summary.map(s => s.custodial)); report("20-multiuser-distinct-wallets", custodials.size === summary.length, [...custodials].join(", "));
process.exit(0);
