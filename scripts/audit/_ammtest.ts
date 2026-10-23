// devnet: buy then sell a graduated coin on PumpSwap from a throwaway wallet funded by the platform
import { Keypair, PublicKey } from "@solana/web3.js";
import { launchWallet } from "@/lib/solana"; import { sendSol, buy, sell, tokenBalance } from "@/lib/trade/curve"; import { poolInfo } from "@/lib/core/amm";
const mint = new PublicKey(process.argv[2]); console.log("pool", JSON.stringify(await poolInfo(mint.toBase58()), (_, v) => typeof v === "bigint" ? v.toString() : v));
const kp = Keypair.generate(); await sendSol(launchWallet(), kp.publicKey, 30_000_000n);
const b = await buy(kp, mint, 10_000_000n); console.log("buy", b.sig, b.tokens);
const bal = await tokenBalance(kp.publicKey, mint); console.log("bal", bal);
const s = await sell(kp, mint, bal); console.log("sell", s.sig, s.lamports);
process.exit(0);
