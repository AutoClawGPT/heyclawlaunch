import { webCtx } from "@/lib/core/web-ctx";
import { listTemplates, draftFromTemplate } from "@/lib/core/templates";
import { confirmLaunch } from "@/lib/core/launch";
import { summary } from "@/lib/core/drafts";
import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 120;
export async function GET() { return Response.json({ templates: await listTemplates() }); }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})); const ctx = await webCtx();
  try {
    if (!ctx.walletKey) throw new UserError("Sign in to launch a template: it launches from your own wallet and the 80% creator fees go to it.");
    if (b.action === "draft") { const r = await draftFromTemplate(ctx, String(b.id)); return Response.json({ draft_id: r.draft.id, ready: r.ready, summary: summary(r.draft), wallet: r.wallet, template: r.template }); }
    if (b.action === "confirm") { if (b.user_confirmed !== true) throw new UserError("Confirm first."); const r = await confirmLaunch(ctx, String(b.draft_id)); return Response.json(r); }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) { return Response.json({ error: e instanceof UserError ? e.message : `Something went wrong: ${String(e.message).slice(0, 200)}` }, { status: e instanceof UserError ? 400 : 500 }); }
}
