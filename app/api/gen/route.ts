import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { webCtx } from "@/lib/core/web-ctx";
import { webUi } from "@/lib/core/web-ui";
import { runTool } from "@/lib/tools/run";
import { prepareLaunch } from "@/lib/core/drafts";
import { pinLogoBytes } from "@/lib/core/logo";
import { getOrCreateCustodial } from "@/lib/keystore";
import { createPending } from "@/lib/brain/agent";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 180;
/** Web buttons: upload / generate / regenerate logo, and "generate everything". All only fill the draft; launching still needs the user's confirm. */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!jar.get("hg_anon")) jar.set("hg_anon", randomBytes(16).toString("hex"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 * 30 });
  const ctx = await webCtx();
  try {
    let draftId: string | null = null, reply = "", image: string | undefined;
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const f = await req.formData(); const file = f.get("file") as File | null; draftId = (f.get("draftId") as string) || null;
      if (!file) return Response.json({ error: "file required" }, { status: 400 });
      const cid = await pinLogoBytes(new Uint8Array(await file.arrayBuffer()));
      const r = await prepareLaunch(ctx, { draft_id: draftId ?? undefined, logo_image: `ipfs://${cid}` }); draftId = r.draft.id; reply = `Logo uploaded.\n\n${r.text}`;
    } else {
      const b = await req.json().catch(() => ({}));
      if (b.action === "idea") {
        const r = await runTool(ctx, "generate_token_idea", { theme: b.theme || undefined, apply_to_draft: true }); if (r.isError) throw new Error(r.text);
        draftId = (r.data as any).draft_id; reply = r.text; image = (r.data as any).image_url;
        if (b.quick) { // signed-in users: fees to their own HeyClawLaunch wallet, SOL pair, then a Confirm (never auto-launch)
          if (!ctx.walletKey) throw new Error("Sign in first for quick launch (fees go to your HeyClawLaunch wallet).");
          const w = await getOrCreateCustodial(ctx.walletKey);
          const q = await prepareLaunch(ctx, { draft_id: draftId!, fee_mode: "wallet", fee_wallet: w, pair: "SOL", skip_socials: true }); reply += `\n\n${q.text}`;
          if (q.ready) { const p = await createPending(ctx, "confirm_launch", { draft_id: draftId }); return Response.json({ reply, draftId, image, pending: p, ui: await webUi(ctx, draftId) }); }
        }
      } else {
        if (!b.draftId) { const r = await prepareLaunch(ctx, {}); b.draftId = r.draft.id; }
        const r = await runTool(ctx, "generate_logo", { prompt: b.prompt || undefined, draft_id: b.draftId, apply_to_draft: true }); if (r.isError) throw new Error(r.text);
        draftId = b.draftId; reply = r.text; image = (r.data as any).image_url;
      }
    }
    return Response.json({ reply, draftId, image, ui: await webUi(ctx, draftId) });
  } catch (e: any) { return Response.json({ error: String(e.message ?? e).slice(0, 300) }, { status: 400 }); }
}
