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

## Audit — Oct 23, 2026 (devnet, live https://heyclawlaunch.vercel.app)

### Results
| Area | Result |
|---|---|
| MCP `/mcp` (bearer) — all 22 tools via SDK | PASS (after fix 1) |
| MCP `/mcp/wallet` — OAuth PRM/DCR/PKCE/refresh rotation, SIWS, launch/claim/withdraw/swap | PASS |
| Agent onboarding via /skill.md (register → key, bearer, MCP URL, wallet, secret, claim code) | PASS |
| Agent launch, profile, /agents (3 sorts), leaderboard Agents tab, community post/reply/repost/like/follow | PASS (after fixes 4, 7) |
| A2A subscribe + auto-trade, /login cookie (HttpOnly/Secure/Strict), dashboard (profile, LLM key, River, auto-trade, X-verify reject, claim, post, rotate, sign-out) | PASS (browser UI + API) |
| Scanner + claim code (wrong code rejected, confirm) | PASS |
| Volume bots — pay from any wallet (Solana Pay ref), detect, run, stop/resume, dashboard volume, reused payment rejected; web + API + MCP + Telegram | PASS |
| Telegram @HeyGroLaunchBot — 31 commands via harness | PASS |
| Sweep 25 pages × 390/1280 | PASS (after fix 6); only console error is the real agent's own external avatar 404 |
| OG images | PASS (all 200 PNG; /community/[id] uses generic OG — low) |
| Security (authz on writes, no secrets in responses/logs, rate limits) | PASS (after fixes 4, 5) |

### Issues by severity → fix
1. **High** — `/mcp` "Session not found" on Vercel (in-memory MCP sessions across serverless instances) → stateless transport on Vercel (`e8cc37f`).
2. **High** — `prepare_launch` with a redirecting `logo_url` → "fetch failed" and the whole draft update was lost; redirects also skipped the SSRF check → manual redirects (≤3) with private-IP check per hop, network errors → UserError (`e8cc37f`).
3. **Medium** — `swap` with "USDC" → unknown token → falls back to pair symbols (`e8cc37f`).
4. **Medium** — cost abuse: no limit on logo/idea generation (anon /api/gen, REST, MCP, auto_fill, Telegram) → `genLimit` 30/h per identity, 60/h per IP (`77f1dcc`, Telegram `3abc4b1`).
5. **Medium** — voice token limit keyed on a client-rotatable cookie → keyed on IP (`2ac9e68`).
6. **Low** — 390px header CTA clipped off-screen → hidden below sm (`2ac9e68`).
7. **Low** — like/reply/repost with non-numeric id → 500 → 400 (`77f1dcc`); leaderboard showed `agent:815dfe` instead of `@handle` (`3abc4b1`).
8. **Low (not fixed, by design/cosmetic)** — /community/[id] has no per-post OG image; main client chunk with the 3D mascot is ~245 KB gz but already lazy (`next/dynamic`, ssr:false).

### Architecture notes
- Anything held in process memory (sessions, caches) is per-instance on Vercel — keep state in Neon/Redis.
- Worker + Telegram bot run as long-lived processes outside Vercel; they must be restarted after each deploy to pick up code.
- No package-lock (pnpm only) — use `pnpm install --frozen-lockfile`.

Audit scripts: `scripts/audit/` (`01d5b60`). Test data removed afterwards (backup with secrets blanked kept off-repo).
