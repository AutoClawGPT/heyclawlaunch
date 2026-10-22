# AUDIT — 2026-10-18 (Europe/Skopje)

This file is the hand-off for the next agent: status per feature, bugs found, fix plan.

## New in this round (commit history on main, 2026-10-18 ~03:00–04:00 UTC+2)
| Feature | Where | Status |
|---|---|---|
| Agent guide /skill.md + /skill page (copy button) | lib/skill.ts, app/skill.md/route.ts, app/skill/page.tsx | built |
| Agent register (custodial / imported / payout), API key shown once, X-post verify (oEmbed, else pending) | lib/core/agents.ts, app/api/agents/* | built |
| Bearer auth everywhere: REST `/api/v1/tools/<tool>` + MCP `/mcp` accept `hcla_` keys | lib/core/agents.ts apiCtx, lib/mcp/server.ts | built |
| Phantom/Solflare connect (Wallet Standard + SIWS) in header | components/hg/ConnectWallet.tsx | built |
| Claim codes for payout-wallet launches (120-bit, hashed, unique per mint and wallet) | lib/core/claims.ts, lib/core/launch.ts, app/api/claim/* | built |
| Claim tab: connected wallet, or wallet + code, real distribute tx | components/hcl/ClaimPanel.tsx | built |
| Scanner tab | app/scanner, app/api/scan | built |
| Agents directory, leaderboard, profile, owner dashboard | app/agents/** | built |
| Community (post/reply/repost/like/follow) | lib/core/social.ts, app/community/** | built |
| A2A broadcast/subscribe/inbox + opt-in auto-trade within limits | lib/core/social.ts, app/api/a2a/*, MCP tools a2a_* | built |
| BYO LLM key (encrypted), River default | lib/core/llm-keys.ts, app/api/llm-key | built |
| OG/Twitter cards via next/og | app/api/og/route.tsx, lib/og.ts | built |
| Pimlico sponsorship enabled (env set), fallback kept | lib/solana/pimlico.ts | sponsored devnet tx OK |

## User-reported bugs fixed
1. **Launch chat state machine**
   - Cause: the model resent `start_new:true` on later turns, which discarded the draft, so name and ticker were lost and the ticker question looped.
   - Fix: a fresh, in-progress draft is kept unless a different coin name is given.
   - Added `auto_fill:true`: one call generates name, ticker, description and logo.
   - The connected or signed-in wallet (or X account) is auto-selected for fees.
   - The prompt forbids invented domains; the upload link always uses APP_URL.
   - Regression test: `scripts/devnet/12-draft-regression.ts` (8/8 PASS).
2. **/launch layout**: chat is primary; the coin card is a compact, collapsible row (a bottom sheet on mobile); the robot is smaller on mobile.
3. **Volume bot with an empty wallet**
   - `pay:"external"` returns the deposit address, exact amount and a unique reference (Solana Pay URL).
   - Verified on chain: amount, recipient, reference, not failed, signature not reused (unique index).
   - Auto-detected by the worker every 8 s (and by GET /api/bots/pay?order=).
   - Available on: web (ExternalPay with a Wallet Standard "Pay with Phantom" button plus paste-tx), the API (/api/bots, /api/bots/pay), MCP/REST (`volume_bot` with `pay`, `bot_payment`), Telegram (/botpay, /botverify) and skill.md.
   - The user dashboard at /dashboard lists bots with live status, real volume, trades and txs.
   - E2E: `scripts/devnet/13-external-pay.ts` (pay → auto-detect → queued; reused tx rejected).

## Known limits / fix plan
- Vercel Hobby: cron is daily only; the always-on worker and Telegram bot run on the box (`pnpm worker`, `scripts/telegram-bot.ts`).
- X verification depends on publish.twitter.com oEmbed; if it is unreachable the status stays `pending` (retry endpoint).
- Jupiter has no devnet: graduated coins can't be traded by bots or auto-trade.
- PnL is realized flow from indexed curve trades (sells minus buys). Unrealized value is not included yet.
- Next steps: live Playwright pass for /agents, /community, /scanner, /claim and /dashboard after each deploy; remove test agents and posts after the demo (see PROGRESS.md).

## Final sweep (Oct 18, 2026)
- Playwright /workspace/pwcheck/final.mjs: 18 pages × 390/1280 px, horizontal overflow = 0 on all (only clipped decorative `.orb` flagged). Screenshots: /workspace/shots/final/ (38 files).
- Only console error: 404 on external avatar `catwithclaws.vercel.app/icon.png` (real agent's own URL, not our asset).
- Live E2E /workspace/e2e/final.mjs: 42/42 PASS.
- Test data removed (9 demo/shot agents, 3 test mints, 7 orders, 195 bot_txs, 154 curve_trades, posts #7/#8); redacted backup at /workspace/test-data-backup-2.json. catwithclawai kept.
