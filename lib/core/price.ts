import { MAINNET_EQUIV_FACTOR } from "@/lib/mainnet-equiv";
export { MAINNET_EQUIV_FACTOR } from "@/lib/mainnet-equiv";
// SOL/USD for display (mainnet price via Jupiter, CoinGecko fallback), cached 60 s.
let cache: { v: number; t: number } | null = null;
export async function solUsd(): Promise<number | null> {
  if (cache && Date.now() - cache.t < 60_000) return cache.v;
  const tries: [string, (j: any) => number][] = [
    ["https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112", j => j?.So11111111111111111111111111111111111111112?.usdPrice],
    ["https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", j => j?.solana?.usd],
  ];
  for (const [u, f] of tries) { try { const v = Number(f(await fetch(u, { signal: AbortSignal.timeout(4000) }).then(r => r.json()))); if (v > 0) { cache = { v, t: Date.now() }; return v; } } catch {} }
  return cache?.v ?? null;
}
export const fmtUsd = (v: number | null) => v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(2)}`;

const isMainnet = () => (process.env.SOLANA_CLUSTER ?? "devnet") === "mainnet-beta" || process.env.SOLANA_CLUSTER === "mainnet";
const tp = ((globalThis as any).__tp ??= new Map<string, { t: number; v: number | null }>());
/** Market USD price of a token from Jupiter v3, then DexScreener (mainnet only; devnet coins have no market data). Cached 15 s. */
export async function marketUsd(mint: string): Promise<{ usd: number; source: string } | null> {
  if (!isMainnet()) return null;
  const c = tp.get(mint); if (c && Date.now() - c.t < 15_000) return c.v != null ? { usd: c.v, source: "cache" } : null;
  const tries: [string, string, (j: any) => number][] = [
    ["jupiter", `https://lite-api.jup.ag/price/v3?ids=${mint}`, j => j?.[mint]?.usdPrice],
    ["dexscreener", `https://api.dexscreener.com/tokens/v1/solana/${mint}`, j => Array.isArray(j) ? Number(j.sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0))[0]?.priceUsd) : NaN],
  ];
  for (const [src, u, f] of tries) { try { const v = Number(f(await fetch(u, { signal: AbortSignal.timeout(4000) }).then(r => r.json()))); if (v > 0) { tp.set(mint, { t: Date.now(), v }); return { usd: v, source: src }; } } catch {} }
  tp.set(mint, { t: Date.now(), v: null }); return null;
}
/** USD per 1 unit of quote: the live SOL/USD rate (USDC = 1). On devnet `scale` = MAINNET_EQUIV_FACTOR (100): devnet curves start at 0.3 SOL virtual reserves vs mainnet's 30 SOL, so USD prices/market caps are shown mainnet-equivalent (curve ×100). Mainnet: scale 1. */
export async function usdPerQuote(opts: { vq0?: number | null; quote?: string } = {}): Promise<{ usd: number | null; scale: number }> {
  const scale = isMainnet() ? 1 : MAINNET_EQUIV_FACTOR; void opts.vq0;
  if (opts.quote === "USDC") return { usd: 1, scale };
  return { usd: await solUsd(), scale };
}
/** USD price + market cap of a coin: on devnet always the exact on-chain curve/pool price × live SOL/USD; on mainnet Jupiter/DexScreener first. */
export async function coinUsd(mint: string, priceQuote: number | null, opts: { vq0?: number | null; quote?: string; supply?: number } = {}) {
  const supply = opts.supply ?? 1e9; const m = await marketUsd(mint);
  if (m) return { priceUsd: m.usd, mcapUsd: m.usd * supply, source: m.source, scaled: false };
  const { usd, scale } = await usdPerQuote(opts);
  const priceUsd = priceQuote != null && usd ? priceQuote * scale * usd : null;
  return { priceUsd, mcapUsd: priceUsd != null ? priceUsd * supply : null, source: "on-chain", scaled: scale !== 1 };
}
