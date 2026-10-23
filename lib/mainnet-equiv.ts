/** Devnet pump.fun curves start at 0.3 SOL of virtual reserves vs mainnet's 30 SOL. Every USD market cap / USD price derived from a devnet curve is multiplied by this factor so coins show mainnet-equivalent values (a fresh coin ≈ $3.2K). SOL amounts, token amounts and curve % are never scaled. */
export const MAINNET_EQUIV_FACTOR = 100;
