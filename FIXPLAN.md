# FIXPLAN — USD prices, real charts, graduated coins (Oct 23, 2026)

Incremental only: no rebuilds, existing curve flow untouched.

## 1. One price source: `lib/core/price.ts`
- `solUsd()` (exists): Jupiter v3 → CoinGecko, 60 s cache.
- NEW `tokenPrice(mint)` → `{ venue: "curve"|"pumpswap", priceQuote, mcapQuote, scale, priceUsd, mcapUsd, source }`
  - mainnet: Jupiter v3 `price?ids=<mint>` → DexScreener `/tokens/v1/solana/<mint>` → on-chain.
  - devnet (no market data exists): on-chain price (bonding curve, or PumpSwap pool reserves after graduation) × SOL/USD, scaled to mainnet-equivalent (×30 SOL / devnet initial virtual SOL), labelled "devnet, mainnet-scale".
  - Helius: used through `SOLANA_RPC_URL` for the on-chain reads.
- Lists (home, explore, bots markets, scanner, Telegram /token, MCP launch_status) show USD mcap via `usdOf(mcapQuote, venue)`.

## 2. Charts
- `/api/candles/[mint]` returns OHLC from indexed trades plus `usd_per_quote` (SOL/USD × scale); `LiveChart` renders USD (toggle SOL), polling stays at 3–5 s.
- Indexer: after graduation also reads the PumpSwap canonical pool's signatures and records swaps (base/quote vault deltas) into `curve_trades` with `venue='amm'`, so the chart continues after migration.

## 3. Graduated coins
- NEW `lib/core/amm.ts`: `poolInfo(mint)` (canonical pool, reserves, price) and `ammBuy/ammSell` via `@pump-fun/pump-swap-sdk` (buyQuoteInput / sellBaseInput).
- `lib/trade/curve.ts` `buy/sell`: when the curve is complete, route to PumpSwap instead of throwing "graduated" → bots, swap tool, A2A auto-trade, Telegram all work on graduated coins.
- `coinInfo`: graduated → price/mcap from the pool, progress 100, "Graduated · PumpSwap" tag, Boost button stays.
- Bots: remove "graduated" rejection (order + start); markets list shows mcap for graduated coins.

## 4. Other fixes found while onboarding ClawTester
- Register silently dropped avatar/banner when ipfs.io rate-limited (429) → gateway fallback + `/api/ipfs/<cid>` proxy URL, `warnings[]` in the response; PATCH accepts banner_url / ipfs://.

## 5. Verification
lint + tsc + build → push → Vercel deploy → restart box worker/bot → MCP 22 tools, agent flow, bots (all 5 kinds incl. a graduated coin), Telegram harness, page sweep 390/1280.
