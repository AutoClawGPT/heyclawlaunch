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

---
# Oct 23 UI pass — token page = pump.fun coin page, Explore = pump.fun board cards

HARD SCOPE: `app/token/[mint]/page.tsx` + its own components, `app/explore/page.tsx` + its card component. Nothing else (no nav, layout, hero, theme, bots, MCP, shared APIs). New read-only API routes used only by the token page are allowed.
Reference: https://pump.fun/coin/7ApeUeU583FEoZUXzqEofRga7w6V3etxM5R4EPKRyHqW (Firecrawl desktop+mobile, /workspace/shots/oct23-ui/pumpfun-ref-*.png, ref-*.md, pumpfun-api.txt).

## Plan (one section at a time, check each)
1. Formatters `lib/fmt.ts` (subscript-zero prices `$0.0₇362`, `$7.73K`, `+12.3%`), `SafeImg` (proxy → inline webp fallback logo → monogram).
2. Token page `components/hcl/TokenTerminal.tsx`: header, chart, trade panel, stats, curve, tabs, info.
3. Read-only routes: `/api/holders/[mint]`, `/api/tokenstats/[mint]`, `/api/wallet-balance/[mint]`.
4. Explore cards `components/hg/CoinCards.tsx` + `lib/core/coinstats.ts`; existing sorts/search/fee/pair filters kept.
5. lint + tsc + build → push (≤4 files/commit) → verify live 1280/390.

## Field map (pump.fun → our devnet source)
| pump.fun field | Our source |
|---|---|
| Logo | `launches.logo_cid` → `/api/ipfs/<cid>` (existing proxy) → `SafeImg` fallback |
| Ticker / name | `launches.ticker/name` |
| Age ("1h") | `launches.launched_at` |
| Contract `7Ape…yHqW` + copy | mint |
| Creator / Dev | `coinInfo().curve.creator` (fallback `launches.creator`) |
| Socials (X, web, TG) | `drafts.x/website/telegram` |
| Market cap $ | curve or PumpSwap pool `priceQuote × supply × solUsd()` (`coinUsd`, `/api/candles usd_per_quote`) |
| 24h vol | `curve_trades` 24 h sum × SOL/USD (`/api/tokenstats`) |
| Holders | `holderCount(mint)` (getProgramAccounts, curve excluded) |
| ATH | `max(curve_trades.price) × supply × SOL/USD` |
| Chart OHLC (Market Cap USD, Price/MCap, USD/SOL, 1m…1d) | `/api/candles/[mint]` (`leaderboard.candles`, real indexed trades incl. PumpSwap `venue='amm'`); 4h/1d aggregated client-side from 1h |
| Stats 5m/1h/24h: price change, volume, buys/sells, buy/sell vol, buyers/sellers | `/api/tokenstats` windows over `curve_trades` |
| Pool info: paired with, total liquidity | `pair_symbol`; curve `realQuote` or pool `poolQuote` × SOL/USD |
| Bonding curve progress %, to graduate, amount required | `coinInfo().curve.progress`, `realQuote`, graduated → "Graduated · PumpSwap" |
| Description | `drafts.description` |
| Creator rewards (recipients %) | `coinInfo().shares` (80/20 split) or holders |
| Buy/Sell panel, balance, 25/50/100% | existing `/api/v1/tools/swap` (preview → confirm), balance `/api/wallet-balance` (devnet getBalance + token accounts) |
| Holders tab (holder, % supply, value) | `/api/holders` (getTokenLargestAccounts, curve labelled) |
| Trades tab (account, type, USD, tokens, SOL, time, txn) | `/api/candles` `trades` (existing) |
| Thread / Callouts (comments) | Community `posts` mentioning `$TICKER` or mint (`/api/tokenstats.comments`) |

## Existing code reused (not rewritten)
- `components/hcl/LiveChart.tsx` chart setup (lightweight-charts v5, candle+volume series, 3 s poll) — pattern reused in TokenTerminal; LiveChart itself untouched (used by bots page).
- `/api/candles/[mint]` + `lib/core/leaderboard.ts` candles/trades/volumeStats — unchanged.
- `lib/core/coin.ts` coinInfo/holderCount, `lib/core/price.ts` coinUsd/solUsd — unchanged.
- `/api/v1/tools/swap` (curve + PumpSwap routing from 265d5e0) for buy/sell — unchanged.
- `/api/ipfs/[cid]` proxy — unchanged; fallback done client-side.
- Stopped worker's WIP (backup /workspace/audit2/stopped-ui-wip.patch): TokenTerminal, CoinCards, SafeImg, fmt, coinstats, holders/tokenstats/wallet-balance reused; its edits to ipfs/candles routes, market.ts, CoinTable, Scanner, Templates, bots, .env.example NOT brought in (out of scope).
