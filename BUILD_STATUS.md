# HeyGro build status (devnet) — 2026-10-18

Legend: ✅ verified · 🟡 built, untested · ⛔ blocked (why) · ❌ not built

## Core / chain
| Item | Status | Evidence / note |
|---|---|---|
| IPFS pin (Pinata) | ✅ | image bafkreidlp6sd…, metadata bafkreibnxvs5… |
| create_v2 launch (tx1) | ✅ | mint 2wQ5cV6U…, tx rg2VJdCn… |
| Fee split 8000/2000, platform → launch wallet, admin revoked (tx2) | ✅ | tx 2vXkSsvi… |
| Claim w/ 650240-lamport rent top-up | ✅ | tx 4QEpQKm4… (+ MCP claim 3btmmE2Y…) |
| 3 launches/day, reset 00:00 UTC | ✅ | test 13 |
| Low launch-wallet guard | ✅ | test 14 |
| Withdraw preview → confirm | ✅ | 5FFDjpkc… (fee payer = launch wallet) |
| Swap preview → confirm (devnet curve) | ✅ | buy 6N52GpoA…, sell 3uqv59CR… |
| Swap via Jupiter (mainnet path) | 🟡 | Jupiter has no devnet; JUP_MOCK=1 |
| USDC-quote coin create | ✅ | 5ENqVCmu… |
| USDC-quote fee split (updateFeeSharesV2) | ⛔ | devnet sim: DistributeCreatorFeesV2 InvalidAccountData (ATAs pre-created, still fails); worker retries |
| Holder-rewards coins | ⛔ | devnet program error 6084 HolderRewardDisabled; needs Surfpool mainnet fork |
| Split retry worker, pairs sync, payer monitor | ✅ | `pnpm worker` |
| Candles/trades indexer | ❌ | /api/candles reads empty table |

## MCP / auth
| Item | Status | Evidence |
|---|---|---|
| 10 tools, verbatim schemas/instructions | ✅ | golden diff 11h; Inspector CLI tools/list |
| Streamable HTTP, 2025-06-18, sessions | ✅ | 11a–c |
| OAuth 2.1: PRM, AS metadata, DCR, PKCE S256, refresh rotation | ✅ | test 12 |
| End-to-end launch over MCP | ✅ | $MCPCAT BU5yUQoe… |
| SIWS wallet sign-in (no X needed) | ✅ | test 17 |
| X sign-in | 🟡 | needs X_CLIENT_ID/SECRET |
| Non-custodial unsigned-tx flow (/api/tx/submit) | ❌ | |

## Brain / bots / web
| Item | Status | Note |
|---|---|---|
| Pluggable registry (river default, openai, anthropic, google, xai, openrouter, ollama, groq, custom) | ✅ river / 🟡 others | others need keys |
| Explicit confirmation gate (launch/claim/withdraw/swap) | ✅ | brain smoke |
| Prompt-injection resistance | 🟡 | test inconclusive (0-balance wallet) |
| Telegram bot (grammY, owner-only Confirm, per-user wallet, polling) | ✅ | $TGBT JDBvEWdj… (simulated updates); live polling |
| Web: home, /launch, /chat, /explore, /token/[mint], /claim, /connect, /docs, /upload | ✅ (HTTP 200) | |
| /admin | ❌ | |
| Voice STT/TTS (ElevenLabs) | ❌ | browser fallback reported |
| X mention bot, Discord | ❌ | no credentials |

## DB
Neon via @neondatabase/serverless (WebSocket, direct endpoint), all tables in schema `heygro`; `public` untouched.

## Run
`pnpm dev` (http://localhost:3100, MCP /mcp & /mcp/wallet) · `pnpm bot` · `pnpm worker` · `pnpm migrate` · `pnpm tsc --noEmit` clean.

## Update 2026-10-18 01:10 (UTC+2)
- UI: 1:1 visual clone of heygrok.fun — uses their compiled stylesheet + fonts (public/hg/), markup converted from their SSR HTML (scripts/ui/h2j.mjs), brand → HeyGro. Pages: home, /launch (call screen; /chat redirects here), /explore (sort tabs, search, fee + pair filters), /token/[mint], /claim (SIWS sign-in + wallet), /connect, /docs. 3D robot hero via react-three-fiber (procedural, pointer-tracking, reacts to listening/thinking; static PNG fallback). Browser voice (Web Speech API) on "Call Gro". ✅ screenshots /workspace/shots/v2-*.png vs heygrok-*.png
- Multi-user E2E (2 simulated Telegram users + 1 SIWS web user): ✅ per-user encrypted custodial wallets (distinct), launch → 8000 user / 2000 launch wallet, claim 80/20 verified by tx decode, owner-only confirm (cross-user rejected), withdraw-all to fresh addresses. See DEVNET_REPORT.md 20-*/21-*.
- Not cloned (404 on heygrok.fun too): /call, /upload, /terms, /privacy. Search ⌘K modal → links to /explore (not a modal).

## Update 2026-10-18 01:35 (UTC+2) — AI image generation
- lib/image-gen (Pollinations default, OpenAI pluggable via IMAGE_PROVIDER; IMAGE_MODEL default black-forest-labs/flux.2-klein-4b; IDEA_MODEL default pollinations:openai/gpt-5.4-nano, falls back to River) → 1024² image → Pinata IPFS → usable as logo_image. 🟡 built, untested live: POLLINATIONS_API_KEY not set.
- CLIs: `pnpm gen-image "<prompt>" out.png [--model] [--size] [--raw] [--no-pin]`, `pnpm gen-token "<theme>" [out.png]`. Missing-key error path ✅.
- MCP/LLM extras generate_logo + generate_token_idea (HeyGrok's 10 unchanged; tools/list now 12) ✅ listed via SDK client.
- Telegram: logo keyboard (Upload / Generate with AI / Regenerate, owner-only), ⚡ Quick launch button + /quick <theme> → photo card + Confirm/Cancel/New idea/New logo; launch still needs Confirm. 🟡 untested live (no key).
- Web: /launch coin card + home card: Upload image / Generate with AI / Regenerate / ✦ Generate everything; /api/gen (quick:true for signed-in users returns a Confirm). 🟡 untested live (no key). Screenshots v3-*.png.
- Test ready: `pnpm tsx --env-file=.env.local scripts/devnet/22-imagegen.ts` (saves /workspace/shots/gen-*.png).
