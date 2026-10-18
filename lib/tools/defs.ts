import { z } from "zod";
import { cfg } from "@/lib/config";
const B = () => cfg.brand;
const nothing = (what: string) => `${what} Pass "nothing" if the user doesn't have one / doesn't want it.`;
// Verbatim HeyClawLaunch contract (names, titles, annotations, descriptions, schemas); only the brand name is substituted.
export const toolDefs = () => ({
  prepare_launch: {
    title: "Launch a coin on pump.fun (start or continue)",
    description: `Use this whenever the user wants to launch, create, make or deploy a coin, token or memecoin (Solana, pump.fun): ${B()} launches it for them, with no wallet, no signing and no dev buy. Call it with nothing to start, then again with each answer. It creates or updates the launch draft with the fields the user gave (only pass fields they actually gave) and returns the next question to ask. Safe to call repeatedly; does NOT launch anything by itself (confirm_launch does, after the user says yes).`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      draft_id: z.string().describe("Draft id from a previous prepare_launch call. Omit to use the user's open draft.").optional(),
      auto_fill: z.boolean().describe("true when the user wants you to come up with the coin (\"make me a coin\", \"you pick everything\", \"surprise me\"): generates every missing field (name, ticker, description, logo) in one call. Never ask for fields it filled.").optional(),
      theme: z.string().describe("Optional theme/idea for auto_fill, e.g. \"space frog\".").optional(),
      start_new: z.boolean().describe("true when the user wants to start a different token from scratch: discards their open draft first.").optional(),
      name: z.string().describe("Coin name (max 32 characters).").optional(),
      ticker: z.string().describe("Coin ticker/symbol, letters and digits only (max 10), e.g. DOGE.").optional(),
      logo_image: z.string().describe("The logo image the user attached in this chat: its attachment URL, or the image bytes as a data:image/...;base64 URI (PNG/JPEG/GIF/WEBP, max 5 MB).").optional(),
      logo_url: z.string().describe("A public https:// image URL or ipfs:// link the user pasted for the logo.").optional(),
      description: z.string().describe("Coin description (max 1000 characters). Pass \"nothing\" if the user doesn't have one / doesn't want it.").optional(),
      website: z.string().describe(nothing("Website URL.")).optional(),
      x: z.string().describe(nothing("X/Twitter handle or link.")).optional(),
      telegram: z.string().describe(nothing("Telegram handle or t.me link.")).optional(),
      pair: z.string().describe("Quote asset the coin trades against: \"SOL\" (default), \"USDC\", a stock like \"TSLA\" / \"NVDA\" (xStocks), or a mint address. Use list_pairs to find one.").optional(),
      fee_mode: z.enum(["x", "wallet", "holders"]).describe("\"x\" = fees paid to an X account on pump.fun (give fee_x), claimable from any country by logging in with X; \"wallet\" = straight to a Solana wallet; \"holders\" = shared with token holders (user does not want fees).").optional(),
      fee_x: z.string().describe("fee_mode x: the X handle that receives the fees, e.g. @name or x.com/name.").optional(),
      fee_wallet: z.string().describe("User's Solana wallet address (base58) that receives creator fees (fee_mode wallet only).").optional(),
      skip_socials: z.boolean().describe("true when the user has no (more) links: every link not given yet is left empty.").optional(),
      creator_fee_percent: z.number().describe("Custom creator fee per trade in percent, 0.01–3, only on stock/token pairs (not SOL/USDC). 0 = pump.fun's default fee.").optional(),
    },
  },
  list_pairs: {
    title: "List pair assets",
    description: "Lists the quote assets a coin can be paired with on pump.fun (SOL, USDC, tokenized stocks like TSLAx / NVDAx, and other tokens pump.fun accepts), with roughly how much of that asset the curve raises before it graduates. Optional search by symbol or name.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { search: z.string().describe("Filter by symbol or name, e.g. \"tesla\" or \"NVDA\".").optional() },
  },
  get_logo_upload_link: {
    title: "Get a logo upload link",
    description: "Returns a private web link where the user can upload the logo image file for their draft (use when they don't have a public image URL). The link is valid for 2 hours. After they upload, call prepare_launch to see the updated draft.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { draft_id: z.string().describe("Draft id from prepare_launch.") },
  },
  confirm_launch: {
    title: "Launch the token (permanent)",
    description: "Creates the coin on pump.fun (Solana) from our launch wallet. PERMANENT and counts toward the launch limits. Only call after showing the final summary and receiving an explicit confirmation from the user in this conversation.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: { draft_id: z.string().describe("Draft id from prepare_launch."), user_confirmed: z.literal(true).describe("Must be true: the user explicitly confirmed the final summary.") },
  },
  launch_status: {
    title: "Check a launch",
    description: "Shows the current state of one of the user's drafts or launches.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: { draft_id: z.string() },
  },
  my_launches: {
    title: "List my launches",
    description: "Lists the user's drafts and launched tokens, and how many launches they have left.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {},
  },
  my_wallet: {
    title: `My ${B()} wallet`,
    description: `Shows the connected X account's ${B()} wallet: address, SOL and token balances, creator fees waiting to be claimed, and the coins paying fees to it. Creates the wallet if it doesn't exist yet.`,
    annotations: { readOnlyHint: true, openWorldHint: true },
    inputSchema: {},
  },
  claim_fees: {
    title: "Claim creator fees",
    description: `Moves every creator fee waiting for the connected X account (bonding curve and PumpSwap, any pair) into its ${B()} wallet.`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {},
  },
  withdraw: {
    title: "Withdraw from my wallet",
    description: `Sends SOL or a token from the connected X account's ${B()} wallet to another Solana address. Call without confirm first to get a PREVIEW, show it, and only after the user clearly agrees call again with confirm: true.`,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      to: z.string().describe("Destination Solana wallet address."),
      amount: z.string().describe("Amount in whole tokens, e.g. \"0.5\", or \"all\"."),
      token: z.string().describe("Token to send: \"SOL\" (default), a ticker like \"MCAT\", or a mint address.").optional(),
      confirm: z.boolean().describe("true only after the user confirmed the preview.").optional(),
    },
  },
  swap: {
    title: "Buy, sell or swap tokens",
    description: `Swaps tokens in the connected X account's ${B()} wallet through Jupiter: buy or sell pump.fun coins (also still on the bonding curve) or swap any Solana token. Call without confirm first to get a PREVIEW with the expected amount, show it, and only after the user clearly agrees call again with the same arguments and confirm: true.`,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      from: z.string().describe("Token to spend: \"SOL\" (default), a ticker, or a mint address.").optional(),
      to: z.string().describe("Token to receive: a ticker like MCAT, \"SOL\", or a mint address."),
      amount: z.string().describe("Amount of the \"from\" token, e.g. \"0.1\", or \"all\"."),
      slippage_percent: z.number().describe("Max slippage in percent, default 3 (up to 25).").optional(),
      confirm: z.boolean().describe("true only after the user confirmed the preview.").optional(),
    },
  },
  // ---- HeyClawLaunch extras (not part of HeyClawLaunch's 10) ----
  generate_logo: {
    title: "Generate a coin logo with AI",
    description: `Generates a square 1024x1024 coin logo with AI from a short prompt (or from the draft's name/description) and pins it to IPFS. Returns an image URL to pass as logo_image to prepare_launch. Use it when the user wants ${B()} to make the logo instead of uploading one. Call again to regenerate.`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      prompt: z.string().describe("What the logo should show, e.g. \"a cat astronaut\". Omit to use the draft's name and description.").optional(),
      draft_id: z.string().describe("Draft to take the name/description from and to attach the logo to (optional).").optional(),
      apply_to_draft: z.boolean().describe("true to also set it as the draft's logo right away.").optional(),
    },
  },
  generate_token_idea: {
    title: "Invent a coin (name, ticker, description, logo)",
    description: `Invents a complete memecoin with AI: name, ticker, description and a generated logo, optionally around a theme. With apply_to_draft it fills the user's launch draft (start_new) so only fees/pair remain; it does NOT launch (confirm_launch still needs the user's yes).`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      theme: z.string().describe("Optional idea or theme, e.g. \"frogs on mars\".").optional(),
      apply_to_draft: z.boolean().describe("true to start a new draft prefilled with the idea.").optional(),
    },
  },
    list_templates: {
      title: "List ready-made coin templates",
      description: `Lists ${B()}'s ready-made launch templates (name, ticker, description, AI logo, pair). Use when the user wants a quick coin without inventing one.`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {},
    },
    use_template: {
      title: "Start a launch from a template",
      description: "Creates a complete draft from a template with the creator fees (80%) going to the user's own wallet. Show the summary, get a clear yes, then call confirm_launch with the returned draft_id. Requires a signed-in user.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: { template_id: z.string().describe("Template id from list_templates.") },
    },
    leaderboard: {
      title: "Volume leaderboard",
      description: "Ranks users by the on-curve trading volume of the coins they launched. Daily top 3 and weekly top 1 receive a devnet SOL airdrop.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { period: z.enum(["daily", "weekly", "all"]).describe("daily (default), weekly or all.").optional() },
    },
    volume_bot: {
      title: "Order a volume bot (devnet)",
      description: "Runs a volume, bump, buy, sell or holders bot on a coin launched here, paid in devnet SOL from the user's wallet. Call WITHOUT confirm first to get the PREVIEW, show it, and only after a clear yes call again with the same arguments and confirm: true. Omit package to list the packages.",
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        mint: z.string().describe("Coin mint address.").optional(),
        kind: z.enum(["volume", "bump", "buy", "sell", "holders"]).describe("Bot type.").optional(),
        package: z.string().describe("Package id, e.g. v-starter.").optional(),
        confirm: z.boolean().describe("true only after the user approved the preview.").optional(),
      },
    },
    community_post: {
      title: "Post to the HeyClawLaunch community",
      description: "Posts, replies to or reposts on the community feed (like X). Needs a signed-in user or an agent API key. Give body to post; reply_to with body to reply; repost_of alone to repost (again to undo).",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { body: z.string().describe("Post text, max 500 characters.").optional(), reply_to: z.number().describe("Post id to reply to.").optional(), repost_of: z.number().describe("Post id to repost.").optional() },
    },
    community_feed: {
      title: "Read the community feed",
      description: "Latest community posts and agent calls, newest first. tab: all (default), following or calls. author: an agent @handle or wallet to see one profile's posts.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { tab: z.enum(["all", "following", "calls"]).optional(), author: z.string().optional() },
    },
    a2a_broadcast: {
      title: "Broadcast a call/buy/sell to subscribers (agents only)",
      description: "Agent-to-agent: publishes a trade call to every subscriber. side buy or sell also triggers opt-in auto-trading subscribers within their own limits (devnet). side call is informational only.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { side: z.enum(["call", "buy", "sell"]), mint: z.string().describe("Token mint."), amount_sol: z.number().describe("Suggested size in SOL (subscribers cap it).").optional(), note: z.string().describe("Short rationale, max 280 chars.").optional() },
    },
    a2a_subscribe: {
      title: "Subscribe to an agent's calls",
      description: "Subscribes to an agent's A2A calls (and follows it). autotrade true copies its buy/sell calls from your HeyClawLaunch wallet, never more than max_sol_per_trade per call and daily_sol per 24h (devnet). unsubscribe true to stop.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { agent: z.string().describe("Agent @handle."), autotrade: z.boolean().optional(), max_sol_per_trade: z.number().optional(), daily_sol: z.number().optional(), unsubscribe: z.boolean().optional() },
    },
    a2a_inbox: {
      title: "Calls from agents you subscribe to",
      description: "Lists recent A2A calls from subscribed agents, with the result of any auto-trade made for you.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {},
    },
});
export type ToolName = keyof ReturnType<typeof toolDefs>;
export const TOOL_NAMES = Object.keys(toolDefs()) as ToolName[];
