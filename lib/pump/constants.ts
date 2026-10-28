// Documented FALLBACK values only. pump.fun hardcodes none of these: the live
// on-chain Global account (fetchGlobal()) is authoritative and overrides them.
export const TOKEN_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const INIT_VIRTUAL_TOKEN = 1_073_000_000_000_000n; // 1.073B * 1e6
export const INIT_VIRTUAL_SOL_MAINNET = 30n * LAMPORTS_PER_SOL;
export const INIT_VIRTUAL_SOL_DEVNET = 300_000_000n; // 0.3 SOL (HCL observed)
export const INIT_REAL_TOKEN = 793_100_000_000_000n; // 793.1M * 1e6
export const TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000n; // 1B * 1e6
export const BPS_DENOM = 10_000n;
