import { conn, launchWallet } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
const lw = launchWallet().publicKey;
for (const a of [lw.toBase58(), ...process.argv.slice(2)]) console.log(a, (await conn().getBalance(new PublicKey(a))) / 1e9);
process.exit(0);
