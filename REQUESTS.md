# REQUESTS — every ask, with status and evidence

Status: **done** (verified earlier, see evidence) · **fixed now** (Oct 23 pass) · **open** (being worked) · **needs user**.
Sources: chat Oct 18 (23 messages, ~55 distinct asks), PROGRESS.md, AUDIT.md, Oct 23 asks. No secrets in this file.

## Product & UI (Oct 18)
- [x] Name the site HeyClawLaunch, a HeyGrok-style launcher with its own design — done (live https://heyclawlaunch.vercel.app, night-market theme)
- [x] Real animated bot (3D claw mascot: eyes follow cursor, blink, talk, celebrate) — done (PROGRESS 01:40)
- [x] Screenshots of every page, desktop + mobile — done (/workspace/shots/final, 38 files; Oct 23 sweep 25 pages × 390/1280)
- [x] Live link to open in Chrome (not local) — done (Vercel from GitHub, auto-deploy on push)
- [ ] Cool art made with Grok Imagine — needs user: Grok Imagine API returns 402 (no credits) → flux fallback used for site art and logos (PROGRESS 02:20). Add xAI image credits to switch back.
- [x] Templates tab: ready-made launches, one click to launch from the connected wallet — done (10 AI templates, `use_template` MCP PASS Oct 23)
- [x] No demo coins/users anywhere — done (test data purged Oct 18 + Oct 23; ClawTester is the one permanent, real test agent)
- [x] Images on the site never broken — done (IPFS proxy races gateways; broken avatar → generated fallback) · fixed now: agent avatar/banner on ipfs.io 429 were silently dropped at register (`lib/core/agents.ts`, commit c5529e9)
- [x] Login tab (API key or wallet), settings page to control the agent — done (/login, /agents/dashboard; cookie HttpOnly/Secure/Strict PASS Oct 23)
- [ ] Mobile side tab listing every tab, show/hide without glitches — open: re-verify in this pass's sweep
- [x] Compress/perf, remove "slides" look — done (home JS 191 → 171 KB gz, ISR, CDN caching; PROGRESS 05:20)
- [x] Use skills/tools first, fast site, no errors — done (lint 0 errors, tsc clean, build clean before each push)
- [x] X/Twitter share card (OG image) for the site link — done (all OG 200 PNG, AUDIT Oct 23) · /community/[id] per-post image: open (re-check)

## Launch, Telegram, wallets
- [x] Real pump.fun devnet launch from site, Telegram, MCP, agents — done (ClawTester launched $CLAWT via MCP Oct 23)
- [x] Telegram bot: full commands, real preview, full setup of a real token — done (31/31 harness Oct 23) · re-run this pass: open
- [x] Telegram: connect/import wallet, launch from own wallet, payout address — done (AUDIT Oct 18)
- [x] Links use the Vercel domain (not localhost) — done (AUDIT Oct 18)
- [x] No "sign your wallet to launch" friction for bot users — done (custodial/no-dev-buy, platform pays)

## Fees, claim, scanner
- [x] 80/20 fee split on chain — done (split tx on every launch)
- [x] Claim tab: connect wallet and claim with a real tx — done
- [x] Unique claim code per launch for payout-only wallets (no duplicates) — done (claim-code check/wrong/confirm PASS Oct 23)
- [x] Scanner tab: paste wallet → launched coins, earned, claimable — done (scanner PASS Oct 23)

## Volume bots (dexlift_bot / dexliftdeployer-style)
- [x] Bots tab with new / about-to-graduate / graduated filters; volume, bump, buy, sell, holders bots; tiers 0.2/1/2/3/5 SOL — done
- [x] Users pay from any wallet (Solana Pay reference) or their HCL wallet, bot starts, real trades, stop/resume — done (bots E2E 12/12 Oct 23)
- [x] Copy the dexlift_bot flow / dexliftdeployer dashboard on our own setup (devnet SOL only) — done (bots dashboard + Telegram /volume /mybots /botpay)
- [ ] Bots run reliably off the box (worker + Telegram bot outlive restarts) — partly done: box supervisor + .bashrc autostart (PROGRESS 05:20); daily Vercel cron also runs one bot pass. A real always-on host (Railway/Fly/VPS) needs user.
- [x] Bots work on graduated coins (local follow-up fix pending push: `globalThis.__pool` name clash between PumpSwap cache and Postgres pool) — fixed now: PumpSwap routing (`lib/core/amm.ts`, 265d5e0); live devnet buy+sell on GRIN1 pool PASS
- [ ] Real orders as ClawTester for every bot kind/tier affordable on devnet, via site, MCP, Telegram — open (devnet faucet dry; see budget note at the bottom)

## Prices & charts
- [x] Real pump.fun data on token pages, not "0.28 SOL" — done Oct 18; Oct 23 correction: "mainnet scale" removed (local, pending push)
- [ ] USD everywhere — open (local fix, not pushed): devnet = EXACT on-chain curve/PumpSwap-pool price × live SOL/USD, no scaling; Jupiter/DexScreener token prices only on mainnet; also added to Telegram /token and MCP launch_status. Earlier version: `coinUsd()` (Jupiter v3 → DexScreener on mainnet, on-chain curve/pool × SOL/USD on devnet via Helius RPC), lists + marquee + token page + chart (c5529e9, 68b7b00, a98f53e)
- [x] Real OHLC charts from real trades, live updating — done (3 s poll) · fixed now: USD/quote toggle, and PumpSwap trades indexed after graduation (68b7b00)
- [x] Graduated token pages: mcap was empty, Boost hidden, swap refused — fixed now (pool price/mcap, "Graduated · PumpSwap", Boost kept, swap via PumpSwap)

## Agents, MCP, skill.md
- [x] /skill.md full agent guide: register → API key, bearer, MCP URL, wallet (+ secret if generated), claim code, X verify — done; ClawTester registered by following it step by step (Oct 23)
- [x] skill.md fixes from the ClawTester walkthrough — fixed now: PATCH docs list banner_url; register now returns `warnings[]` when an image can't be loaded (c5529e9)
- [x] MCP /mcp works for any agent (Claude, Hermes, Claw…) — done (22/22 tools as ClawTester Oct 23, 26 calls PASS)
- [x] Wallet MCP /mcp/wallet with OAuth + SIWS — done (13/13 Oct 23) · re-run this pass: open
- [x] Personal connector URL — done (AUDIT Oct 18)
- [x] Agent profiles, directory, leaderboard, verified badge — done (/agents, /agents/<handle>)
- [x] Community (post/reply/repost/like/follow) and A2A calls + copy-trading — done (ClawTester posts #41–#45, A2A auto-trade PASS)
- [x] Permanent real test agent ClawTester (pfp + banner generated, wallet generated, never delete) — fixed now (profile https://heyclawlaunch.vercel.app/agents/clawtester)
- [ ] X verification with a real post — needs user (requires a real tweet containing the verify code; rejection paths PASS)

## Leaderboard & airdrops
- [x] Real-time volume leaderboard of all users; daily top 3 + weekly top 1 airdrop — done (Upstash, daily cron)

## Voice (Deepgram)
- [x] Call Claw with Deepgram Voice Agent (Flux listen/speak) — done
- [x] Think provider Google gemini-3.1-flash-lite + do_arithmetic + end_conversation, fallback if it errors — fixed now (a98f53e): array fallback to gpt-4o-mini per turn, plus client retry with fallback-only if Google is rejected at setup; live Deepgram test PASS (arithmetic 17.66, goodbye → end_conversation)
- [x] Call bug: "you came up…" draft flow with blank name — done (AUDIT Oct 18 launch-chat fixes)

## Infra
- [x] GitHub repo with full README/images — done (AutoClawGPT/heyclawlaunch)
- [x] Vercel with all env vars, Neon (heygro schema only), Upstash — done
- [ ] Pimlico sponsored tx — off by default behind PIMLICO_API_KEY; result reported in this pass (open)
- [x] Downloadable project + progress log — done (repo + PROGRESS.md/AUDIT.md)
- [x] No slides/decks — done (none produced)
- [x] catwithclawai untouched — done

## Devnet budget
Platform wallet and devnet faucet are the limit for bot tiers above Starter; see report.
