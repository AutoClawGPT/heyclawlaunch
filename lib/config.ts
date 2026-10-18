export const cfg = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  brand: process.env.BRAND ?? "HeyClawLaunch",
  cluster: (process.env.SOLANA_CLUSTER ?? "devnet") as "devnet" | "mainnet-beta" | "localnet",
  rpc: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  launchMin: Number(process.env.LAUNCH_MIN_LAMPORTS ?? 50_000_000),
  platformBps: Number(process.env.PLATFORM_SHARE_BPS ?? 2000),
  limitPerDay: Number(process.env.LAUNCH_LIMIT_PER_DAY ?? 3),
  launchesEnabled: (process.env.LAUNCHES_ENABLED ?? "true") !== "false",
};
export const clusterQs = () => (cfg.cluster === "mainnet-beta" ? "" : cfg.cluster === "devnet" ? "?cluster=devnet" : `?cluster=custom&customUrl=${encodeURIComponent(cfg.rpc)}`);
export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}${clusterQs()}`;
