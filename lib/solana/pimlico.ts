// Optional Pimlico Solana fee sponsorship (Kora JSON-RPC). Off unless PIMLICO_API_KEY is set.
// Pimlico supports BOTH mainnet and devnet (devnet sponsorship is free); the paymaster may only be the fee payer
// (plus rent for accounts the tx creates) and spends at most 0.1 SOL per tx. Docs: https://docs.pimlico.io/guides/how-to/solana
import { Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { cfg } from "@/lib/config";
export const pimlicoEnabled = () => !!process.env.PIMLICO_API_KEY;
const url = () => `https://solana.pimlico.io/v1/${cfg.cluster === "mainnet-beta" ? "mainnet" : "devnet"}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;
async function rpc(method: string, params: unknown = {}) {
  const r = await fetch(url(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30_000) });
  const j: any = await r.json(); if (j.error) throw new Error(`pimlico ${method}: ${j.error.message ?? JSON.stringify(j.error)}`); return j.result;
}
/** Builds a v0 tx with Pimlico's paymaster as fee payer, signs with `signers`, and lets the paymaster co-sign and broadcast. */
export async function sponsoredSend(ixs: TransactionInstruction[], signers: Keypair[]): Promise<string> {
  const { signer_address } = await rpc("getPayerSigner"); const { blockhash } = await rpc("getBlockhash");
  const msg = new TransactionMessage({ payerKey: new PublicKey(signer_address), recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  const tx = new VersionedTransaction(msg); tx.sign(signers);
  const res = await rpc("signAndSendTransaction", { transaction: Buffer.from(tx.serialize()).toString("base64") });
  return res.signature ?? res.signed_transaction ?? String(res);
}
