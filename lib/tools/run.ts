import type { Ctx } from "@/lib/core/ctx";
import { UserError } from "@/lib/core/validate";
import { prepareLaunch, launchStatus, loadDraft, newUploadLink } from "@/lib/core/drafts";
import { confirmLaunch, myLaunches } from "@/lib/core/launch";
import { getPairs, formatPairs } from "@/lib/core/pairs";
import { myWallet, claimFees, withdraw, swap } from "@/lib/core/wallet";
import type { ToolName } from "./defs";
import { generateLogo, generateTokenIdea, logoPrompt } from "@/lib/image-gen";
import { listTemplates, draftFromTemplate } from "@/lib/core/templates";
import { leaderboard, nextReset, PRIZES } from "@/lib/core/leaderboard";
import { KINDS, orderBot } from "@/lib/core/bots";

export type ToolOut = { text: string; isError?: boolean; data?: Record<string, unknown> };
/** Executes one of the 10 tools against the shared core. Used by MCP, the web chat brain and the bots. */
export async function runTool(ctx: Ctx, name: ToolName, args: any): Promise<ToolOut> {
  try {
    switch (name) {
      case "prepare_launch": { const r = await prepareLaunch(ctx, args ?? {}); return { text: r.text, isError: !!r.error, data: { draft_id: r.draft.id, ready: r.ready, upload_url: r.uploadUrl, draft: pick(r.draft) } }; }
      case "list_pairs": {
        let p = await getPairs(); const s = args?.search?.toLowerCase();
        if (s) p = p.filter(x => x.symbol.toLowerCase().includes(s) || x.name.toLowerCase().includes(s) || x.mint === args.search);
        return { text: formatPairs(p) };
      }
      case "get_logo_upload_link": { const d = await loadDraft(ctx, args.draft_id); const { url } = await newUploadLink(d.id); return { text: `Upload the logo here (private link, valid 2 hours): ${url}\nAfter uploading, call prepare_launch with draft_id ${d.id}.`, data: { upload_url: url } }; }
      case "confirm_launch": {
        if (args?.user_confirmed !== true) throw new UserError("user_confirmed must be true: show the summary and get an explicit yes first.");
        const r = await confirmLaunch(ctx, args.draft_id); return { text: r.text, data: { mint: r.mint, page_url: r.pageUrl, pump_url: r.pumpUrl, create_sig: r.createSig, split_sig: r.splitSig } };
      }
      case "launch_status": return { text: await launchStatus(ctx, args.draft_id) };
      case "my_launches": return { text: await myLaunches(ctx) };
      case "my_wallet": return { text: await myWallet(ctx) };
      case "claim_fees": return { text: await claimFees(ctx) };
      case "withdraw": return { text: await withdraw(ctx, args) };
      case "swap": return { text: await swap(ctx, args) };
      case "generate_logo": {
        let subject = args?.prompt as string | undefined; let d: any = null;
        if (args?.draft_id || !subject) { try { d = await loadDraft(ctx, args?.draft_id); } catch {} }
        if (!subject) subject = d?.name ? `${d.name}${d.ticker ? ` ($${d.ticker})` : ""}${d.description ? `: ${d.description}` : ""}` : "a friendly robot mascot";
        const g = await generateLogo(args?.prompt ? logoPrompt(args.prompt) : logoPrompt(subject));
        let text = `Logo generated: ${g.url}\nPass it as logo_image to prepare_launch${d ? ` (draft_id ${d.id})` : ""}.`;
        let draft: any;
        if (args?.apply_to_draft && d) { const r = await prepareLaunch(ctx, { draft_id: d.id, logo_image: g.url }); text = `Logo generated and set: ${g.url}\n\n${r.text}`; draft = pick(r.draft); }
        return { text, data: { image_url: g.url, ipfs: g.ipfs, cid: g.cid, model: g.model, draft } };
      }
      case "generate_token_idea": {
        const t = await generateTokenIdea(args?.theme);
        let text = `Idea: ${t.name} ($${t.ticker})\n${t.description}\nLogo: ${t.logo.url}`; let draft: any, draftId: string | undefined;
        if (args?.apply_to_draft) { const r = await prepareLaunch(ctx, { start_new: true, name: t.name, ticker: t.ticker, description: t.description, logo_image: t.logo.url }); text += `\n\n${r.text}`; draft = pick(r.draft); draftId = r.draft.id; }
        return { text, data: { name: t.name, ticker: t.ticker, description: t.description, image_url: t.logo.url, cid: t.logo.cid, draft_id: draftId, draft } };
      }
      case "list_templates": { const t = await listTemplates(); return { text: t.length ? t.map(x => `• ${x.id}: ${x.name} ($${x.ticker}) — ${x.description ?? ""}`).join("\n") : "No templates yet.", data: { templates: t } }; }
      case "use_template": { const r = await draftFromTemplate(ctx, args.template_id); return { text: r.text, data: { draft_id: r.draft.id, ready: r.ready, draft: pick(r.draft) } }; }
      case "leaderboard": {
        const period = args?.period ?? "daily"; const rows = await leaderboard(period, 10); const nr = nextReset();
        const prizes = period === "daily" ? PRIZES.daily : period === "weekly" ? PRIZES.weekly : [];
        return { text: (rows.length ? rows.map(r => `${r.rank}. ${r.label} — ${r.volume.toFixed(3)} SOL volume · ${r.coins} coin(s)${prizes[r.rank - 1] ? ` · prize ${Number(prizes[r.rank - 1]) / 1e9} SOL` : ""}`).join("\n") : "No volume yet in this period.") + `\nNext payout: ${period === "weekly" ? nr.weekly : nr.daily}`, data: { rows, next: nr } };
      }
      case "volume_bot": {
        if (!args?.package || !args?.kind || !args?.mint) return { text: Object.entries(KINDS).map(([k, v]) => `${v.title} (${k}): ${v.desc}\n` + v.pkgs.map(p => `  - ${p.id}: ${p.name}, ${Number(p.price) / 1e9} SOL — ${p.blurb}`).join("\n")).join("\n\n") + "\n\nTell me the coin (mint), the bot and the package." };
        const r = await orderBot(ctx, args); return { text: r.text, data: { order_id: (r as any).orderId, preview: !!(r as any).preview } };
      }
    }
    return { text: `Unknown tool ${name}`, isError: true };
  } catch (e: any) {
    if (e instanceof UserError) return { text: e.message, isError: true };
    console.error("tool error", name, e);
    return { text: `Something went wrong: ${String(e?.message ?? e).slice(0, 200)}`, isError: true };
  }
}
const pick = (d: any) => ({ name: d.name, ticker: d.ticker, logo_cid: d.logo_cid, fee_mode: d.fee_mode, fee_x_handle: d.fee_x_handle, fee_wallet: d.fee_wallet, pair: d.pair_symbol, status: d.status });
