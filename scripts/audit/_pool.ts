import { PublicKey } from "@solana/web3.js";
import { conn } from "@/lib/solana";
import { canonicalPumpPoolPda, OnlinePumpAmmSdk } from "@pump-fun/pump-swap-sdk";
for (const m of process.argv.slice(2)) {
  const pk = canonicalPumpPoolPda(new PublicKey(m)); const info = await conn().getAccountInfo(pk);
  console.log(m, pk.toBase58(), !!info);
  if (info) { const sdk = new OnlinePumpAmmSdk(conn()); const p: any = await sdk.fetchPool(pk); console.log(JSON.stringify({ base: p.baseMint.toBase58(), quote: p.quoteMint.toBase58(), bva: p.poolBaseTokenAccount.toBase58(), qva: p.poolQuoteTokenAccount.toBase58() }));
    const [b, q] = await Promise.all([conn().getTokenAccountBalance(p.poolBaseTokenAccount), conn().getTokenAccountBalance(p.poolQuoteTokenAccount)]); console.log(b.value.uiAmountString, q.value.uiAmountString); }
}
process.exit(0);
