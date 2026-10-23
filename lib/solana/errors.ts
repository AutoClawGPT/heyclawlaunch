/** Transient RPC/network failures that are safe to retry before a tx is sent. */
export const isTransient = (e: unknown) => /429|Too Many Requests|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|timeout|503|502|Service Unavailable|blockhash not found/i.test(String((e as any)?.message ?? e));
/** Maps raw Solana/RPC errors to a short, user-friendly sentence (raw text stays in logs/audit). */
export function friendlyChainError(e: unknown): string {
  const m = String((e as any)?.message ?? e);
  if (/insufficient (funds|lamports)|"Custom":1\b|0x1\b|InsufficientFundsForRent/i.test(m)) return "Not enough SOL in the wallet to cover this transaction and fees.";
  if (/block height exceeded|expired|TransactionExpired/i.test(m)) return "Solana was too busy and the transaction expired before it confirmed. Nothing was charged — please try again.";
  if (/429|Too Many Requests/i.test(m)) return "The Solana RPC is rate-limiting us right now. Please try again in a minute.";
  if (/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|timeout|50[23]/i.test(m)) return "Couldn't reach the Solana network. Please try again in a minute.";
  if (/slippage|TooMuchSolRequired|TooLittleSolReceived|"Custom":600[23]/i.test(m)) return "The price moved too much (slippage). Please try again.";
  if (/simulation failed/i.test(m)) return `The transaction was rejected in simulation: ${m.replace(/^simulation failed:\s*/, "").slice(0, 140)}`;
  return m.slice(0, 200);
}
