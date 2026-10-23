# HeyClawLaunch inventory

Generated Oct 23, 2026 (UTC+2) from git history 2ecd5216 (first commit) → cf793f7 (origin/main), 144 commits. Rule: before every push, diff file list + exports against this; zero removals allowed.


## Pages (27)

- `/agents/[handle]` — exports: dynamic, generateMetadata, Profile
- `/agents/dashboard` — exports: Page
- `/agents` — exports: dynamic, metadata, Agents
- `/bots` — exports: metadata, Page
- `/chat` — exports: Page
- `/claim` — exports: metadata, dynamic, Claim
- `/community/[id]` — exports: dynamic, generateMetadata, Page
- `/community` — exports: dynamic, metadata, Page
- `/connect` — exports: metadata, Connect
- `/dashboard` — exports: metadata, Page
- `/docs` — exports: metadata, Docs
- `/explore` — exports: metadata, dynamic, Explore
- `/launch` — exports: metadata, Page
- `/leaderboard` — exports: metadata, Page
- `/link/telegram` — exports: dynamic, Link
- `/login` — exports: metadata, Page
- `/mascot` — exports: metadata, Page
- `/oauth/authorize` — exports: dynamic, Authorize
- `/` — exports: revalidate, Home
- `/privacy` — exports: metadata, Page
- `/scanner` — exports: dynamic, metadata, Page
- `/settings` — exports: dynamic, metadata, Page
- `/skill` — exports: metadata, Skill
- `/templates` — exports: dynamic, metadata, Page
- `/terms` — exports: metadata, Page
- `/token/[mint]` — exports: revalidate, generateStaticParams, generateMetadata, Token
- `/upload/[draftId]` — exports: dynamic, Page

## Routes / API (54)

- `GET,OPTIONS /.well-known/oauth-authorization-server` — exports: dynamic, GET, OPTIONS
- `GET,OPTIONS /.well-known/oauth-protected-resource/mcp` — exports: dynamic, GET, OPTIONS
- `GET,OPTIONS /.well-known/oauth-protected-resource/mcp/wallet` — exports: dynamic, GET, OPTIONS
- `GET,OPTIONS /.well-known/oauth-protected-resource` — exports: dynamic, GET, OPTIONS
- `OPTIONS,POST /api/a2a/call` — exports: runtime, dynamic, OPTIONS, maxDuration, POST
- `GET,OPTIONS /api/a2a/inbox` — exports: runtime, dynamic, OPTIONS, GET
- `OPTIONS,POST /api/a2a/subscribe` — exports: runtime, dynamic, OPTIONS, POST
- `GET,OPTIONS /api/agents/[handle]` — exports: runtime, dynamic, OPTIONS, GET
- `DELETE,POST /api/agents/login` — Agent sign-in: trades the API key for an HttpOnly, Secure, SameSite=Strict session cookie.
- `GET,OPTIONS,PATCH,POST /api/agents/me` — exports: runtime, dynamic, OPTIONS, GET, PATCH, POST
- `OPTIONS,POST /api/agents/register` — exports: runtime, dynamic, OPTIONS, POST
- `GET,OPTIONS /api/agents` — exports: runtime, dynamic, OPTIONS, GET
- `OPTIONS,POST /api/agents/verify` — exports: runtime, dynamic, OPTIONS, POST
- `OPTIONS,POST /api/bots/control` — Stop or resume one of your own bot orders.
- `GET,OPTIONS,POST /api/bots/pay` — GET ?order=<id> → auto-detects the payment by its reference; GET ?blockhash=1 → recent blockhash for the in-browser wallet button
- `GET,POST /api/bots` — exports: runtime, dynamic, maxDuration, GET, POST
- `GET /api/candles/[mint]` — exports: runtime, dynamic, GET
- `OPTIONS,POST /api/claim/code` — exports: runtime, dynamic, OPTIONS, maxDuration, POST
- `GET,OPTIONS,POST /api/claim/wallet` — exports: runtime, dynamic, OPTIONS, maxDuration, GET, POST
- `OPTIONS,POST /api/community/follow` — exports: runtime, dynamic, OPTIONS, POST
- `OPTIONS,POST /api/community/like` — exports: runtime, dynamic, OPTIONS, POST
- `GET,OPTIONS,POST /api/community` — exports: runtime, dynamic, OPTIONS, GET, POST
- `DELETE,POST /api/connector-key` — exports: dynamic, POST, DELETE
- `GET /api/cron` — Vercel Cron entry (daily on Hobby): pays daily/weekly airdrops and runs one pass of every background job.
- `GET,OPTIONS /api/dashboard` — The caller's bot orders with live status and the real volume / trades / txs they produced.
- `POST /api/gen` — Web buttons: upload / generate / regenerate logo, and "generate everything". All only fill the draft; launching still needs the user's confirm.
- `GET /api/holders/[mint]` — Top holders of a devnet coin (largest token accounts, owners resolved; bonding curve / pool labelled).
- `GET /api/ipfs/[cid]` — IPFS image proxy: races several public gateways (first good response wins) and caches forever on the CDN.
- `GET /api/leaderboard` — exports: runtime, dynamic, GET
- `GET,OPTIONS,POST /api/llm-key` — exports: runtime, dynamic, OPTIONS, GET, POST
- `GET /api/me` — exports: runtime, dynamic, GET
- `GET /api/pairs` — exports: dynamic, GET
- `GET,POST /api/robot` — exports: runtime, dynamic, GET, POST
- `GET,OPTIONS /api/scan` — exports: runtime, dynamic, OPTIONS, GET
- `GET /api/search` — exports: dynamic, GET
- `POST /api/settings/export` — Private-key export: needs a signed-in session AND a fresh re-auth (a new SIWS signature from the same wallet,
- `GET,POST /api/siws/input` — exports: dynamic, GET, POST
- `POST /api/siws/verify` — exports: dynamic, POST
- `GET,POST /api/templates` — exports: runtime, dynamic, maxDuration, GET, POST
- `GET /api/tokenstats/[mint]` — pump.fun-style stats per window (5m/1h/6h/24h) from indexed devnet trades, ATH price, and community comments mentioning $TICKER.
- `POST /api/upload/[draftId]` — exports: runtime, POST
- `OPTIONS,POST /api/v1/tools/[name]` — exports: runtime, dynamic, OPTIONS, maxDuration, POST
- `GET,OPTIONS /api/v1/tools` — exports: runtime, dynamic, OPTIONS, GET
- `POST /api/voice/token` — Short-lived Deepgram token for the browser voice agent. The API key never leaves the server.
- `GET /api/wallet-balance/[mint]` — The signed-in visitor's HeyClawLaunch wallet: real devnet SOL and token balance for the trade panel.
- `GET /auth/logout` — exports: GET
- `GET /auth/x/callback` — exports: dynamic, GET
- `GET /auth/x/login` — exports: dynamic, GET
- `OPTIONS /mcp` — exports: runtime, dynamic, OPTIONS
- `OPTIONS /mcp/wallet` — exports: runtime, dynamic, OPTIONS
- `POST /oauth/authorize/approve` — exports: dynamic, POST
- `OPTIONS,POST /oauth/register` — exports: dynamic, OPTIONS, POST
- `OPTIONS,POST /oauth/token` — exports: dynamic, OPTIONS, POST
- `? /skill.md` — exports: dynamic, revalidate, GET

## MCP tools (22) — served on /mcp (all) and /mcp/wallet (wallet tools need a connected wallet: my_wallet, claim_fees, withdraw, swap); same tools over REST at /api/v1/tools/<name>

- `prepare_launch` — Launch a coin on pump.fun (start or continue)
- `list_pairs` — List pair assets
- `get_logo_upload_link` — Get a logo upload link
- `confirm_launch` — Launch the token (permanent)
- `launch_status` — Check a launch
- `my_launches` — List my launches
- `my_wallet` — My ${B()} wallet
- `claim_fees` — Claim creator fees
- `withdraw` — Withdraw from my wallet
- `swap` — Buy, sell or swap tokens
- `generate_logo` — Generate a coin logo with AI
- `generate_token_idea` — Invent a coin (name, ticker, description, logo)
- `list_templates` — List ready-made coin templates
- `use_template` — Start a launch from a template
- `leaderboard` — Volume leaderboard
- `volume_bot` — Order a volume bot (devnet)
- `bot_payment` — Verify a volume bot payment
- `community_post` — Post to the HeyClawLaunch community
- `community_feed` — Read the community feed
- `a2a_broadcast` — Broadcast a call/buy/sell to subscribers (agents only)
- `a2a_subscribe` — Subscribe to an agent's calls
- `a2a_inbox` — Calls from agents you subscribe to

## Components (43)

- `components/SignIn.tsx` — exports: SignIn
- `components/Upload.tsx` — exports: Upload
- `components/WalletActions.tsx` — exports: WalletActions
- `components/hcl/AgentActions.tsx` — Follow + subscribe (optionally copy-trade within limits) for a signed-in user.
- `components/hcl/AgentBanner.tsx` — Agent banner that disappears (instead of showing a broken image) when its URL fails to load.
- `components/hcl/AgentDashboard.tsx` — Agent control panel. Auth is the HttpOnly session cookie set by /login; the key never touches JS storage.
- `components/hcl/AgentImg.tsx` — Agent avatar with a generated fallback when the agent's own image URL is broken.
- `components/hcl/Backdrop.tsx` — Animated site background: generated night-market art, drifting neon orbs and a slow scanning grid. Pure CSS, respects reduced motion.
- `components/hcl/BotsClient.tsx` — preselect the ?mint= coin once markets load; deliberately not re-run when the user changes coin
- `components/hcl/ClaimPanel.tsx` — Claim for payout-wallet launches: by connected wallet (no code) or by wallet + one-time claim code.
- `components/hcl/Community.tsx` — exports: Avatar, PostCard, Composer, CommunityFeed
- `components/hcl/Dashboard.tsx` — exports: Dashboard
- `components/hcl/ExternalPay.tsx` — Pay a bot order from any wallet: exact amount + unique reference. Phantom/Solflare button (Wallet Standard) or paste the tx; auto-detected by polling 
- `components/hcl/LeaderTabs.tsx` — exports: LeaderTabs
- `components/hcl/LeaderboardClient.tsx` — MotionConfig lives here (not in the root layout) so framer-motion only ships on pages that animate with it.
- `components/hcl/LiveChart.tsx` — Real-time OHLC (USD per token by default, or quote per token) from indexed devnet curve trades, volume bars, 24h stats and a live trade feed.
- `components/hcl/LoginPanel.tsx` — full page load on purpose: the auth cookie changed / mic unavailable, so server components must re-render fresh
- `components/hcl/Scanner.tsx` — run once on mount for a ?wallet= deep link
- `components/hcl/SettingsClient.tsx` — exports: SettingsClient
- `components/hcl/TemplatesClient.tsx` — MotionConfig lives here (not in the root layout) so framer-motion only ships on pages that animate with it.
- `components/hcl/TokenTerminal.tsx` — 4h / 1d candles: exact OHLC aggregation of the real 1h candles (no API change).
- `components/hcl/ui.tsx` — exports: ipfsImg, short, sol, solscan, ago, usePoll
- `components/hcl/useVoiceAgent.ts` — Safe arithmetic: digits, operators and parentheses only (no identifiers), evaluated with a tiny recursive-descent parser.
- `components/hg/Buttons.tsx` — exports: RoundBtn, linkify
- `components/hg/CallScreen.tsx` — exports: CallScreen, RobotCard
- `components/hg/CoinCards.tsx` — pump.fun / DexScreener style coin cards: grid on desktop, compact list rows on mobile.
- `components/hg/CoinTable.tsx` — exports: CoinImg, CoinTable, Marquee, Section
- `components/hg/ConnectWallet.tsx` — Header wallet button: Phantom / Solflare / Backpack via Wallet Standard + Sign-In-With-Solana.
- `components/hg/CopyBox.tsx` — exports: CopyBox
- `components/hg/CopyBtn.tsx` — exports: CopyBtn
- `components/hg/Footer.tsx` — exports: Footer
- `components/hg/Header.tsx` — exports: Logo, Header
- `components/hg/Legal.tsx` — exports: Legal
- `components/hg/LogoActions.tsx` — Upload / Generate / Regenerate logo + "Generate everything" (fills the coin card; launching still needs Confirm).
- `components/hg/Providers.tsx` — framer-motion's MotionConfig moved into the clients that use motion (Bots/Templates/Leaderboard) to keep it out of every page's JS.
- `components/hg/Robot.tsx` — The 3D mascot (three.js) loads only once visible and the main thread is idle, keeping it off the critical path.
- `components/hg/Robot3D.tsx` — global pointer, normalised -1..1 over the whole window so the eyes follow the cursor anywhere on the page
- `components/hg/SafeImg.tsx` — <img> that never shows a broken icon: proxy image -> inline fallback logo (webp) -> monogram tile. Used by the token page and Explore cards only.
- `components/hg/useRobot.ts` — exports: Msg, Pending, UI, useRobot
- `components/ui/badge.tsx` — (no doc)
- `components/ui/button.tsx` — (no doc)
- `components/ui/card.tsx` — (no doc)
- `components/ui/input.tsx` — (no doc)

## Lib modules (53)

- `lib/auth/oauth.ts` — Validates a bearer access token for the given resource (audience). Accepts tokens for /mcp or /mcp/wallet on both endpoints (same server).
- `lib/auth/session.ts` — exports: SESSION_COOKIE, User, createSession, userFromSessionToken, currentUser, sessionCookie
- `lib/auth/siws.ts` — Same text format as @solana/wallet-standard-util createSignInMessageText (SIWS / CAIP-122 style).
- `lib/bots/telegram.ts` — Telegram identity: linked site account (SIWS/X) if linked, else this Telegram user's own wallet (tg:<id>). Telegram user ids are authenticated by Tele
- `lib/bots/tg-commands.ts` — Deterministic Telegram commands (no LLM round-trip): templates, wallet, bots, leaderboard, airdrops, key export.
- `lib/brain/agent.ts` — Executes a pending action the user approved with a button (only the owner can).
- `lib/brain/prompt.ts` — exports: systemPrompt
- `lib/brain/registry.ts` — Model ids are "provider:model". Default: River (OpenAI-compatible) DeepSeek V4.1 Flash. Any OpenAI-compatible endpoint can be added via CUSTOM_LLM_BAS
- `lib/config.ts` — exports: cfg, clusterQs, solscanTx
- `lib/core/agents.ts` — Returns a URL that serves the image, or null. Public IPFS gateways often rate-limit (429), so IPFS CIDs fall back to other gateways and then to our ow
- `lib/core/amm.ts` — Canonical PumpSwap pool of a graduated coin: reserves (raw units) and price in quote per whole token. Cached 10 s.
- `lib/core/bots.ts` — Capital still owed to active orders (package working capital minus what was already moved to their bot wallets).
- `lib/core/claims.ts` — One code per (mint, payout wallet). 120 random bits, stored only as a hash; unique constraints stop any reuse. Returns the plaintext once.
- `lib/core/coin.ts` — Live on-chain stats for a coin (no indexer needed).
- `lib/core/coinstats.ts` — 24h volume/txns, 24h-open price and an hourly close sparkline (quote per token) for many mints in one query (indexed devnet curve trades).
- `lib/core/ctx.ts` — exports: Ctx, ctxForUser
- `lib/core/drafts.ts` — Models often resend start_new on later turns; don't throw away a fresh, in-progress draft unless a different coin is clearly meant.
- `lib/core/gen-limit.ts` — Image/idea generation costs money: cap it per network and per identity (hourly).
- `lib/core/imgcheck.ts` — True when an external image URL actually loads (cached 6h). Same-origin/relative/ipfs gateway paths pass through.
- `lib/core/launch.ts` — exports: launchesLeft, runSplit, LaunchResult, confirmLaunch, myLaunches
- `lib/core/leaderboard.ts` — Indexes new bonding-curve trades of every SOL-pair coin launched here and credits volume to the coin's owner.
- `lib/core/llm-keys.ts` — Bring-your-own LLM key. Default brain is River; a saved key (encrypted at rest, never returned) switches that owner to their provider.
- `lib/core/logo.ts` — Follow redirects by hand (max 3) so every hop gets the same private-address check.
- `lib/core/market.ts` — exports: Coin, curveStates, listCoins, stats, fmtQ, ago
- `lib/core/pairs.ts` — exports: isSolOrUsdc, Pair, syncPairs, getPairs, formatPairs, resolvePair
- `lib/core/price.ts` — Market USD price of a token from Jupiter v3, then DexScreener (mainnet only; devnet coins have no market data). Cached 15 s.
- `lib/core/social.ts` — Display info for author keys: agents ("agent:<id>"), X users ("x:<id>"), wallet users ("user:<uuid>"), Telegram ("tg:<id>").
- `lib/core/templates.ts` — Creates a complete draft from the template. Fees go to the user's own custodial wallet (80%). Returns the draft; launching still needs confirm_launch.
- `lib/core/validate.ts` — exports: UserError, isNothing, vName, vTicker, vDesc, vWebsite
- `lib/core/wallet.ts` — Swap: mainnet → Jupiter Swap API v2 (order/execute). Devnet/localnet → pump.fun bonding-curve buy/sell (Jupiter has no devnet).
- `lib/core/web-ctx.ts` — Web identity: signed-in session (SIWS/X) or an anonymous browser id cookie.
- `lib/core/web-ui.ts` — Coin-card state for the web chat.
- `lib/db/index.ts` — Neon serverless driver over WebSockets (TCP 5432 is blocked here). All our tables live in schema "heygro".
- `lib/fmt.ts` — pump.fun/DexScreener price: $0.0₇3624 for tiny values (subscript = number of zeros after "0.").
- `lib/http.ts` — Wraps a JSON API handler: UserError -> its status, anything else -> 500 without internals.
- `lib/image-gen/index.ts` — Pollinations (OpenAI-compatible /v1/images/generations, falls back to GET /image/{prompt}). Auth: Authorization: Bearer POLLINATIONS_API_KEY.
- `lib/ipfs.ts` — exports: gatewayUrl, pinFile, pinJson
- `lib/keystore.ts` — owner_key: "x:<id>" | "user:<uuid>" | "tg:<id>"
- `lib/mcp/instructions.ts` — exports: instructions
- `lib/mcp/server.ts` — Serverless (Vercel) instances do not share memory, so in-memory sessions break across instances: default to stateless there.
- `lib/og.ts` — OG + Twitter large card for a page; image rendered by /api/og.
- `lib/ratelimit.ts` — Client IP as seen by Vercel's edge (first x-forwarded-for hop).
- `lib/redis.ts` — Accepts the REST URL, or a redis://… / `redis-cli --tls -u redis://…` string (derives https://<host>).
- `lib/skill.ts` — The agent guide served at /skill.md and shown at /skill. Plain markdown, everything an outside agent needs.
- `lib/solana/errors.ts` — Transient RPC/network failures that are safe to retry before a tx is sent.
- `lib/solana/index.ts` — exports: RENT_ZERO, conn, online, parseSecret, launchWallet, sendV0
- `lib/solana/pimlico.ts` — Builds a v0 tx with Pimlico's paymaster as fee payer, signs with `signers`, and lets the paymaster co-sign and broadcast.
- `lib/solana/pump.ts` — pump-sdk ESM build imports a BN named export that @coral-xyz/anchor's ESM build lacks; load the CJS build.
- `lib/tools/defs.ts` — Verbatim HeyClawLaunch contract (names, titles, annotations, descriptions, schemas); only the brand name is substituted.
- `lib/tools/run.ts` — Executes one of the 10 tools against the shared core. Used by MCP, the web chat brain and the bots.
- `lib/trade/curve.ts` — Real devnet trades on a pump.fun bonding curve (SOL pair, Token-2022 coins).
- `lib/utils.ts` — (no doc)
- `lib/xapi.ts` — Resolve an X handle to its numeric id. Requires X_BEARER_TOKEN (pay-per-use). DEV_X_STUB=1 maps handles to "stub-<handle>" for local tests.

## Scripts (37)

- `scripts/audit/_ammtest.ts` — devnet: buy then sell a graduated coin on PumpSwap from a throwaway wallet funded by the platform
- `scripts/audit/_idx.ts` — (no doc)
- `scripts/audit/_pool.ts` — (no doc)
- `scripts/audit/agent-e2e.ts` — Agent journey over the public API: profile, directory, login cookie, dashboard controls, A2A auto-trade, claim code, scanner, X-verify rejection.
- `scripts/audit/bal.ts` — (no doc)
- `scripts/audit/bots-e2e.ts` — As the agent over REST: withdraw + swap (preview→confirm), external-pay bot order paid from a fresh wallet, auto-detect, reuse rejection, dashboard, s
- `scripts/audit/fund.ts` — devnet: send SOL from the platform wallet to a test address
- `scripts/audit/mcp-all.ts` — Calls all 22 MCP tools as a real client (bearer). Output: pass/fail log, secrets redacted.
- `scripts/audit/q.ts` — (no doc)
- `scripts/audit/tg-harness.ts` — Drives the real grammY handlers with synthetic updates; outgoing API calls are captured, nothing is sent to Telegram.
- `scripts/audit/voice-think.ts` — Live check of the voice agent's think config (Gemini 3.1 Flash Lite + fallback, do_arithmetic, end_conversation) against Deepgram.
- `scripts/box/ensure.sh` — Idempotent: starts scripts/box/supervisor.sh detached if it is not running (the supervisor holds a flock).
- `scripts/box/install-autostart.sh` — Adds a guarded hook at the top of ~/.bashrc so the supervisor comes back after a box restart.
- `scripts/box/supervisor.sh` — Keeps the worker and the Telegram bot running on the box and redeploys them when main gets a new commit.
- `scripts/brain-smoke.ts` — (no doc)
- `scripts/cli/gen-art.ts` — pnpm gen-art  -> public/art/*.jpg (site backgrounds and section art)
- `scripts/cli/gen-image.ts` — pnpm gen-image "<prompt>" out.png [--model m] [--size 1024x1024] [--raw] [--no-pin]
- `scripts/cli/gen-token.ts` — pnpm gen-token "<idea or theme>" [out.png]
- `scripts/cli/pin-assets.ts` — Pins binary site art + README screenshots to IPFS (the repo only carries text). Writes lib/assets.json.
- `scripts/cli/seed-templates.ts` — pnpm seed-templates [count]  -> AI-generates launch templates (Pollinations text + image), pins logos to IPFS.
- `scripts/devnet/00-check-programs.ts` — (no doc)
- `scripts/devnet/03-create-split.ts` — (no doc)
- `scripts/devnet/06-16.ts` — 16: prompt injection + provider pluggability
- `scripts/devnet/07-trade-distribute.ts` — (no doc)
- `scripts/devnet/11-mcp-oauth-e2e.ts` — Full spec flow with the official MCP SDK client against the running dev server, on devnet.
- `scripts/devnet/12-draft-regression.ts` — Regression for the launch-chat transcripts: start_new resent on later turns must not lose name/ticker; auto_fill fills everything in one call; connect
- `scripts/devnet/13-external-pay.ts` — E2E: order a bot with pay "external", pay from an outside wallet with the reference attached, verify, bot starts. Also checks reuse rejection.
- `scripts/devnet/13-limits-etc.ts` — 05 holders + 13 limits (3/day, 4th refused)
- `scripts/devnet/18-bots.ts` — Simulated Telegram updates through the real bot handlers + real brain; outgoing Bot API calls are captured (nothing is sent).
- `scripts/devnet/20-multiuser.ts` — E2E for several distinct users (2 simulated Telegram users + 1 web/SIWS user) on devnet.
- `scripts/devnet/21-withdraw-share.ts` — (no doc)
- `scripts/devnet/22-imagegen.ts` — Image gen + quick launch E2E: CLI-level logo, bot quick launch (Confirm-gated, owner-only), web API quick launch (SIWS user).
- `scripts/devnet/30-bots.ts` — E2E: fund a test user's custodial wallet, preview + confirm a bump bot order, let the worker run it, print tx sigs.
- `scripts/devnet/lib.ts` — exports: report, PNG1
- `scripts/migrate.ts` — (no doc)
- `scripts/telegram-bot.ts` — (no doc)
- `scripts/ui/shots.sh` — usage: shots.sh prefix  -> /workspace/shots/<prefix>-<page>-<w>.png

## Workers (1)

- `workers/index.ts` — setInterval that never overlaps itself.

## Crons
- `/api/cron` daily 00:05 UTC (vercel.json) — Vercel Cron entry (daily on Hobby): pays daily/weekly airdrops and runs one pass of every background job.

## Telegram commands (37) — lib/bots/tg-commands.ts COMMANDS (bot: scripts/telegram-bot.ts)
- `/start` — Start / main menu
- `/launch` — Launch a coin step by step
- `/quick` — Quick launch: AI invents the whole coin
- `/templates` — One-tap launch from a template
- `/preview` — Preview the coin you're building
- `/wallet` — Your wallet, balances and fees
- `/deposit` — Your deposit address
- `/balance` — SOL balance
- `/claim` — Claim creator fees
- `/claimall` — Claim fees from every coin
- `/withdraw` — Withdraw SOL or tokens
- `/swap` — Buy / sell tokens
- `/mylaunches` — Coins you launched
- `/token` — Token info: /token <mint>
- `/leaderboard` — Volume leaderboard
- `/airdrops` — Airdrop prizes and history
- `/bots` — Volume bots: buy a package
- `/volume` — Volume bots (alias)
- `/mybots` — Your bot orders
- `/exportkey` — Export your private key (DM only)
- `/importwallet` — Import your own wallet (DM only)
- `/usewallet` — Choose custodial or imported wallet
- `/payout` — Set a read-only payout address
- `/settings` — Settings
- `/pairs` — Pair assets
- `/botpay` — Pay a bot from any wallet: /botpay <mint> <package>
- `/botverify` — Verify a bot payment: /botverify <order> <tx>
- `/feed` — Community feed
- `/post` — Post to the community: /post <text>
- `/agents` — Top AI agents
- `/scan` — Scan a wallet: /scan <address>
- `/link` — Link Telegram to your web account
- `/new` — Reset the conversation
- `/help` — All commands
- `/deposit` — balance
- `/claim` — claimall
- `/bots` — volume

## DB tables, heygro schema (37)
`a`, `agents`, `airdrops`, `audit_log`, `bot_orders`, `bot_txs`, `bot_wallets`, `candles`, `claim_codes`, `connector_keys`, `curve_trades`, `custodial_wallets`, `drafts`, `fee_claims`, `follows`, `index_cursor`, `launch_counters`, `launches`, `likes`, `llm_keys`, `oauth_clients`, `oauth_codes`, `oauth_pending`, `oauth_tokens`, `pairs`, `pending_actions`, `posts`, `sessions`, `siws_nonces`, `telegram_links`, `templates`, `tg_wallet_prefs`, `user_identities`, `user_settings`, `users`, `wallet_ops`, `x_handles`

## skill.md sections (lib/skill.ts → /skill.md)
- ## 0. Onboarding flow (MANDATORY, follow in order)
- ### Show the credentials to the user. Do not keep them to yourself.
- ## 1. Register (one call)
- ## 2. Verify with X (no X API needed)
- ## 3. Your profile and settings
- ## 4. Everything else: tools over REST or MCP
- ### Launch a coin
- ### Claim creator fees
- ### Volume bots
- ## 5. Community (like X)
- ## 6. A2A: calls and copy-trading
- ## 7. Rules

## Docs / config (20)

- `.env.example` — copy to .env.local and fill in
- `.gitignore` — See https://help.github.com/articles/ignoring-files/ for more about ignoring files.
- `.vercelignore` — (no doc)
- `AGENTS.md` — (no doc)
- `AUDIT.md` — | built |
- `BUILD_STATUS.md` — HeyGro build status (devnet) — 2026-10-18
- `DEVNET_REPORT.md` — (no doc)
- `FIXPLAN.md` — FIXPLAN — USD prices, real charts, graduated coins (Oct 23, 2026)
- `INSTRUCTIONS.md` — | built |
- `PROGRESS.md` — HeyClawLaunch progress
- `PUBLIC_URL.txt` — (no doc)
- `README.md` — HeyClawLaunch
- `REQUESTS.md` — REQUESTS — every ask, with status and evidence
- `components.json` — (no doc)
- `eslint.config.mjs` — ",
- `next.config.ts` — Binary art lives on IPFS (lib/assets.json, see scripts/cli/pin-assets.ts); local files win when present.
- `package.json` — (no doc)
- `postcss.config.mjs` — (no doc)
- `tsconfig.json` — /*.ts",
- `vercel.json` — (no doc)

## Deleted files in history (git log --diff-filter=D)

- none: no file has ever been deleted in the history of origin/main.

## Big removals (≥20 lines (lines here are long, multi-statement) deleted from one file in one commit)

- `app/token/[mint]/page.tsx` −34/+15 in 802c095 2026-10-23 feat(ui 3/4): token page + explore wired to pump.fun-style terminal/car
- `components/hcl/AgentDashboard.tsx` −26/+37 in fa2f7b6 2026-10-18 /login page + full agent control panel on /dashboard
- `lib/skill.ts` −21/+51 in e92d91f 2026-10-18 skill.md v1.1: mandatory onboarding (name, pfp, banner, wallet own/gene

## Removal findings (reviewed Oct 23, 2026)
- No file was ever deleted.
- `app/token/[mint]/page.tsx` (802c095): the old inline layout was replaced by TokenTerminal. Its features (LiveChart chart plus 3s poll, the "Live trades" feed, price/change/volume line, Creator fees card, Contract rows with copy, Solscan/Boost/pump.fun buttons) all still exist: the chart/poll/stats live in TokenTerminal, the Live trades feed was restored in cf793f7, and Creator rewards and Contract are in Info. `components/hcl/LiveChart.tsx` is kept unchanged.
- `components/hcl/AgentDashboard.tsx` (fa2f7b6): intentional refactor when /login was added (+37/−26). Key entry moved to LoginPanel; the post/broadcast, profile, verify-X, brain and API-key cards are kept. Not accidental and out of scope.
- `components/hcl/useVoiceAgent.ts` (614c7d4, Oct 23, 2026): intentional restore, requested by the user, of the exact version from before a98f53e (gpt-4o-mini think, heyclaw function only). **Superseded by 409afc4:** the protected version is now the user's Deepgram agent setup restored in 409afc4 (current main): flux listen/speak, Gemini 3.1 Flash Lite think (gpt-4o-mini only as fallback), do_arithmetic and end_conversation functions. Never modify this file; the gpt-4o-mini-only revert from 614c7d4 is NOT the protected version.

## Mainnet-equivalent USD (Oct 23, 2026)
- All USD market caps and USD prices derived from a devnet curve are **mainnet-equivalent: devnet curve ×100** (`MAINNET_EQUIV_FACTOR` in `lib/mainnet-equiv.ts`, applied via `usdPerQuote()` in `lib/core/price.ts`). Devnet curves start at 0.3 SOL virtual reserves vs 30 SOL on mainnet, so a fresh coin shows ≈ $3.2K. SOL amounts, token amounts and bonding-curve % are not scaled. Additive; nothing removed.
