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
