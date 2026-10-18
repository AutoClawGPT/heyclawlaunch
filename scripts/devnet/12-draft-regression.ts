// Regression for the launch-chat transcripts: start_new resent on later turns must not lose name/ticker; auto_fill fills everything in one call; connected wallet auto-selected for fees.
import { prepareLaunch } from "@/lib/core/drafts";
import { sql } from "@/lib/db";
import { Keypair } from "@solana/web3.js";
let fail = 0; const ok = (c: any, m: string) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fail++; };
(async () => {
  const k = `test:reg-${Date.now()}`; const ctx: any = { ownerKey: k, surface: "test" };
  // transcript 1: name, then ticker with a resent start_new, then logo
  let r = await prepareLaunch(ctx, { start_new: true, name: "Moon Otter" });
  r = await prepareLaunch(ctx, { start_new: true, ticker: "OTTER" });
  ok(r.draft.name === "Moon Otter" && r.draft.ticker === "OTTER", "start_new resend keeps name + ticker");
  ok(!/NEXT QUESTION: .*ticker/i.test(r.text), "does not re-ask the ticker");
  r = await prepareLaunch(ctx, { draft_id: r.draft.id, ticker: "OTTER" });
  ok(r.draft.name === "Moon Otter", "name persists across calls");
  ok(!r.uploadUrl || r.uploadUrl.startsWith(process.env.APP_URL!), "upload link uses APP_URL");
  // transcript 2: "make me a coin and launch" with a connected wallet
  const w = Keypair.generate().publicKey.toBase58(); const ctx2: any = { ownerKey: k + "b", surface: "test", walletAddress: w };
  const r2 = await prepareLaunch(ctx2, { start_new: true, auto_fill: true });
  ok(!!r2.draft.name && !!r2.draft.ticker && !!r2.draft.logo_cid && r2.draft.description != null, "auto_fill sets name, ticker, logo, description in one call");
  ok(r2.draft.fee_mode === "wallet" && r2.draft.fee_wallet === w, "connected wallet auto-selected for fees");
  ok(r2.ready, `draft ready for confirm (${r2.text.split("\n").find(l => l.startsWith("NEXT")) ?? "READY"})`);
  // transcript 3: no wallet -> only fees asked
  const r3 = await prepareLaunch({ ownerKey: k + "c", surface: "test" } as any, { start_new: true, auto_fill: true });
  ok(/NEXT QUESTION:.*(fee|wallet)/i.test(r3.text) && !!r3.draft.name, "without a wallet it asks only for fees");
  await sql`delete from drafts where owner_key like ${k + "%"}`;
  console.log(fail ? `${fail} FAILED` : "ALL PASS"); process.exit(fail ? 1 : 0);
})();
