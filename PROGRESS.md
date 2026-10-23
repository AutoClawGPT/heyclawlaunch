# HeyClawLaunch progress
- 01:33 Vercel: https://heyclawlaunch.vercel.app live (public, devnet env vars set, MCP at /mcp)
- 01:40 Redesign: night-market theme, R3F claw mascot (cursor eyes, blink, talk, celebrate), terms/privacy/404; redeployed
- 01:41 Image test: generate_logo PASS, generate_token_idea PASS, Telegram quick launch PASS (mint CqR2xf…), web quick launch hit per-IP daily limit -> rerun after 00:00 UTC
- 01:50 DEEPGRAM + Upstash (REST URL fixed) added to .env.local and Vercel
- 01:50 Order changed: everything local first, then GitHub, then Vercel (earlier Vercel deploy stays as preview; final deploy via repo import)
- 02:20 Built: templates (10 AI templates seeded), leaderboard+indexer+airdrops (Upstash), volume bots (5 kinds), settings/export key, animated backdrop, site art (Grok Imagine 402 -> flux fallback)
- 02:35 Volume bot tiers 0.2/1/2/3/5 SOL; real-time OHLC charts + live trade feed; token page 404 for non-platform mints
- 02:45 GitHub repo: https://github.com/AutoClawGPT/heyclawlaunch (pushing)

## 02:25 (UTC+2) — repo + Vercel from Git, quality gate
- Repo: https://github.com/AutoClawGPT/heyclawlaunch (all source pushed; Vercel project connected to it, auto-deploys on push)
- Live: https://heyclawlaunch.vercel.app · MCP https://heyclawlaunch.vercel.app/mcp · wallet MCP https://heyclawlaunch.vercel.app/mcp/wallet
- Env on Vercel: APP_URL / SIWS_DOMAIN / MCP_ALLOWED_ORIGINS = Vercel domain, SOLANA_CLUSTER=devnet, CRON_SECRET, DEEPGRAM_API_KEY (+ all others)
- tsc clean, eslint 0 errors, pnpm build clean; vercel.json: pnpm frozen lockfile, daily cron /api/cron (airdrops + one pass of index/bots/split), maxDuration 60 on LLM routes
- Demo/test data removed from heygro schema (16 E2E coins + their trades/bot orders/airdrops; backup /workspace/backup-test-data-20261018.json); Redis leaderboard rebuilt from real trades
- Telegram: deterministic /help /deposit /balance /wallet /claim /claimall /mylaunches /token /preview /templates /leaderboard /airdrops /bots /volume /mybots /exportkey (DM, warning + confirm, spoiler + protected) /settings — all exercised through the real bot handlers
- Deepgram Voice Agent: flux-general-en v2 listen, flux-cole-en v2 speak, single client-side function `heyclaw` -> our brain (/api/robot) — E2E tested (FunctionCallRequest -> brain -> spoken reply, 1.5 MB audio)
- Charts: tokens without trades show the pump.fun starting price instead of an empty state
- Live Playwright sweep (15 pages x 2 widths): 28/30 clean; IPFS proxy 404s fixed by racing gateways

## 2026-10-18 — bug report fixes (live-verified)
- Token page: USD mcap at mainnet scale (devnet curve ×100, labelled), price, curve %, holders, 24h vol, live chart + trade feed. PASS
- Volume bots: token page "Boost" → /bots?mint= now opens any coin (API returns `focus`); browser test with a signed-in SIWS user paid 0.2 SOL and the worker traded for real. Telegram pay & start also passes. PASS
- Connector URL button shows errors; the MCP SDK lists 16 tools on /mcp and /mcp/wallet. PASS
- Telegram links use the Vercel domain; import wallet / payout address / custodial-vs-imported switch. PASS
- Pimlico: optional behind PIMLICO_API_KEY, works on mainnet and devnet, off by default. PASS
- Live Playwright sweep: ALL CLEAN.

## 2026-10-18 03:00–04:00 (UTC+2) — agents, community, A2A, claim codes, scanner, OG; launch-chat + bot payment fixes
See AUDIT.md for the full status table. Regression scripts: scripts/devnet/12-draft-regression.ts, 13-external-pay.ts.
- Oct 18: final sweep clean, test data purged (see AUDIT.md).

## Oct 23, 2026 (UTC+2) — full devnet audit
- MCP, agent flow, A2A, dashboard UI, scanner/claim, volume bots (web/API/MCP/Telegram), 25-page sweep, OG, security: all PASS after fixes e8cc37f, 77f1dcc, 2ac9e68, 3abc4b1 (see AUDIT.md "Audit — Oct 23, 2026")
- Test agents/coins/orders removed from heygro schema + Redis leaderboard; catwithclawai untouched

## Oct 23, 2026 05:20–06:30 (UTC+2) — hardening pass (supervisor autostart, perf, reliability, rate limits)
- Box: no cron/systemd on the box (PID 1 is tini), so `scripts/box/install-autostart.sh` puts a guarded hook at the top of `~/.bashrc` that runs `scripts/box/ensure.sh` (flock-idempotent) — every agent shell/terminal after a box restart brings the supervisor back. Verified: killed the supervisor → next shell restarted it (worker + @HeyGroLaunchBot polling). Supervisor now stops promptly on TERM.
- Perf: home ISR 20 s, /token/[mint] on-demand ISR 10 s (chart/feed still live client-side); CDN cache on /api/pairs (5 min), /api/templates (1 min), /api/leaderboard (10 s), /api/search (15 s), /api/candles (3 s); framer-motion out of the root layout, wallet sign-in sheet lazy → home JS 191 KB → 171 KB gz.
- Reliability: `sendV0` retries transient RPC errors before sending and checks signature status when confirmation times out (no false failures); `friendlyChainError` for launch/claim/bots/Telegram; a launch that fails after the coin exists on chain now says so (mint + "don't relaunch") instead of "nothing was created".
- Security: `lib/ratelimit.ts` (Upstash fixed window, fails open); global per-IP limit in `api()` (300 GET / 60 writes per min) + explicit limits on robot (LLM, 20/min, message caps), MCP (240/min), OAuth register/token/approve, SIWS input/verify (bad JSON → 400), agent login, gen, bots, upload, connector-key, export, public read APIs.
- Live tests after deploy: MCP 22/22 tools (26 calls) PASS · wallet MCP OAuth/SIWS/launch/claim/withdraw/swap 13/13 PASS · agent flow 32/32 PASS · volume bots 12/12 PASS · dashboard UI 12/12 PASS · Telegram harness 31/31 PASS · 25-page sweep overflow 0, no console errors.
- Test data removed (2 agents, 1 SIWS user, 2 mints, 3 orders, 49 bot txs, 47 trades, 6 posts, Redis lb entries); secrets-blanked backup /workspace/audit2/backup-test-data-20261023-run4.json. catwithclawai untouched.

## Oct 23, 2026 06:55–07:10 (UTC+2) — resume pass
- STEP 0: INSTRUCTIONS.md (all instructions, no secrets) committed fc14c5f.
- STEP 1: pushed price/AMM fixes a831846 (exact devnet USD, `__ammPool` rename fixes $NaN), f34c060 (no mainnet-scale labels, Telegram /token mcap), 926c7f4 (REQUESTS, SWAP_MINT e2e). Live: GRIN1 $506.20 (4.8758 SOL PumpSwap mcap), CLAWT $36.10 (0.3477 SOL curve mcap). PASS
- STEP 2: MCP swap-only buy+sell PASS on CLAWT (curve) and GRIN1 (PumpSwap).
- STEP 3: ClawTester bot orders BLOCKED — platform wallet below 1 SOL bot reserve, devnet faucet 429.
- STEP 4: 26 pages × 390/1280 = 52 shots in /workspace/shots/oct23, 0 overflow, 0 $NaN, 0 broken images, 0 console errors (except expected 404 page); sidebar open/close PASS; OG post/agent/site 200 PNG. Fixed: OG avatar fallback (d93fd81).
- STEP 5: Pimlico sponsored devnet tx PASS. Temp test data removed (ct_peer_tmp, 6 MCP-test SIWS users, 2 $MCPCAT mints, 2 MCPCAT bot orders incl. the unpaid one, 48 trades, 51 bot txs, 6 Redis lb entries); 0.27 SOL swept back to the platform wallet first; secrets-blanked backup /workspace/audit2/backup-test-data-20261023-run5.json. ClawTester + catwithclawai untouched.

## Oct 23, 2026 07:14–07:50 (UTC+2) — bot capacity fix + real purchases of every bot kind
- Faucets: Helius devnet 500, public devnet 429, others failed; user airdropped 10 SOL to platform wallet. Swept audit3_bot 0.2368 + audit3_peer 0.0931 SOL to platform. BOT_RESERVE_SOL stays 1 (Vercel prod/preview + /workspace/hcl-run/.env.local).
- 31080a7: capacity = balance + incoming price − outstanding capital of active orders − reserve ≥ this package's capital; also checked for pay-from-any-wallet orders before issuing a deposit address; clear refusal text. 18dddd7: .env.example. b19c993: holder booster 0.007 SOL/holder (was failing with InsufficientFundsForRent).
- ClawTester (paid from its own wallet 2Qbg…; funded from platform) — all trades real on devnet, appear in /api/bots feed, /api/candles trades (chart) and dashboard volume:
  - volume Starter CLAWT (site, tx-hash pay 5eCHxX…) 31+/40 trades PASS
  - buy Starter CLAWT (site, f2nL7u…) 11 buys, stopped → stays paused PASS
  - holders Starter CLAWT (site, 3Zc5mF…) 23+/24 holders after fix PASS
  - sell Starter CLAWT (MCP volume_bot, 4bTUzE…) 10/10 slices done PASS
  - bump Starter CLAWT (Telegram /botpay + /botverify, 5HV5eD…) 18+/100 PASS
  - volume Starter GRIN1 graduated/PumpSwap (site, 2W4KTc…) 9 trades, stop → paused, resume → queued PASS
  - volume Growth GRIN1 (site, 3GJ2sn…) running PASS
- Remaining: MAX_ACTIVE=4 slots limits parallel orders; holder/volume bots tick ~1 trade per 6–20 s so full tiers take minutes–hours.
