import { PublicKey } from "@solana/web3.js";
import { GLOBAL_PDA, PUMP_FEE_CONFIG_PDA, QUOTE_CONTROL_PDA } from "@/lib/solana/pump";
import { conn, launchWallet } from "@/lib/solana";
const c = conn();
const want: Record<string, string> = { pump: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", pump_fees: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", pump_amm: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", mayhem: "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e" };
for (const [n, a] of Object.entries(want)) { const i = await c.getAccountInfo(new PublicKey(a)); console.log(n, i ? `OK executable=${i.executable}` : "MISSING"); }
for (const [n, p] of Object.entries({ GLOBAL_PDA, PUMP_FEE_CONFIG_PDA, QUOTE_CONTROL_PDA })) console.log(n, (await c.getAccountInfo(p as PublicKey)) ? "initialized" : "MISSING");
console.log("rent0", await c.getMinimumBalanceForRentExemption(0));
console.log("launch wallet", launchWallet().publicKey.toBase58(), (await c.getBalance(launchWallet().publicKey)) / 1e9, "SOL");
