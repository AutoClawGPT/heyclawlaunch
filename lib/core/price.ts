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
/** pump.fun mainnet starts every curve at 30 SOL virtual; devnet's global uses a smaller start. Scale for a mainnet-equivalent USD view. */
export const MAINNET_VQ0 = 30_000_000_000;
export const fmtUsd = (v: number | null) => v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(2)}`;
