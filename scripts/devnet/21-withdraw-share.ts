import { Keypair, PublicKey } from "@solana/web3.js";
import { conn, launchWallet } from "@/lib/solana";
import { runTool } from "@/lib/tools/run";
import { createPending, executePending } from "@/lib/brain/agent";
import { report } from "./lib";
const c = conn(), L = launchWallet().publicKey.toBase58();
const users = JSON.parse(process.argv[2]) as { owner: string; claim: string; custodial: string }[];
for (const u of users) {
  const ctx: any = { ownerKey: u.owner, walletKey: u.owner, surface: "telegram" };
  const tx = await c.getTransaction(u.claim, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  const keys = tx!.transaction.message.getAccountKeys({ accountKeysFromLookups: tx!.meta!.loadedAddresses }).keySegments().flat().map(k => k.toBase58());
  const d = (a: string) => { const i = keys.indexOf(a); return tx!.meta!.postBalances[i] - tx!.meta!.preBalances[i]; };
  const custGross = d(u.custodial), prefund = tx!.meta!.preBalances[keys.indexOf(u.custodial)] === 0 ? 650240 : 0;
  const userFees = custGross - prefund, platform = d(L) + prefund + tx!.meta!.fee;
  const dest = Keypair.generate().publicKey.toBase58();
  const prev = await runTool(ctx, "withdraw", { to: dest, amount: "all", token: "SOL" });
  const p = await createPending(ctx, "withdraw", { to: dest, amount: "all", token: "SOL" }); const r: any = await executePending(ctx, p.id);
  const sig = /tx\/([1-9A-HJ-NP-Za-km-z]{60,90})/.exec(r.out?.text ?? "")?.[1]; const bal = await c.getBalance(new PublicKey(dest));
  const ratio = userFees / (userFees + platform);
  report(`21-split-withdraw-${u.owner}`, bal > 0 && Math.abs(ratio - 0.8) < 0.01, `claim ${u.claim}: user fees ${userFees}, platform share to launch wallet ${platform} (user ratio ${(ratio * 100).toFixed(2)}%); preview "${prev.text.split("\n")[0].slice(0, 80)}"; withdraw all ${sig} -> ${dest} now ${bal} lamports`);
}
process.exit(0);
