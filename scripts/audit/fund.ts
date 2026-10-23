// devnet: send SOL from the platform wallet to a test address
import { conn, launchWallet } from "@/lib/solana";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
const [to, sol] = process.argv.slice(2);
const sig = await sendAndConfirmTransaction(conn(), new Transaction().add(SystemProgram.transfer({ fromPubkey: launchWallet().publicKey, toPubkey: new PublicKey(to), lamports: Math.round(Number(sol) * 1e9) })), [launchWallet()]);
console.log("sig", sig); process.exit(0);
