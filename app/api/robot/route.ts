import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { webCtx } from "@/lib/core/web-ctx";
import { runAgent, executePending } from "@/lib/brain/agent";
import { sql } from "@/lib/db";
import { gatewayUrl } from "@/lib/ipfs";
import { webUi as ui } from "@/lib/core/web-ui";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  const el = !!process.env.ELEVENLABS_API_KEY;
  return Response.json({ enabled: true, voice: el ? "elevenlabs" : "browser", hearing: el ? "elevenlabs" : "browser" });
}
export async function POST(req: Request) {
  const jar = await cookies();
  if (!jar.get("hg_anon")) jar.set("hg_anon", randomBytes(16).toString("hex"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 * 30 });
  const ctx = await webCtx();
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return Response.json({ error: "messages required" }, { status: 400 });
  try {
    if (body.confirmActionId) {
      const r = await executePending(ctx, String(body.confirmActionId));
      const reply = "error" in r ? r.error : r.out.text;
      return Response.json({ reply, draftId: body.draftId ?? null, ui: await ui(ctx, body.draftId ?? null) });
    }
    const msgs = body.messages.filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-30);
    const r = await runAgent(ctx, msgs, { draftId: body.draftId ?? null, model: body.model });
    return Response.json({ reply: r.reply, draftId: r.draftId, pending: r.pending ?? null, model: r.model, tools: r.toolCalls.map(c => c.name), ui: await ui(ctx, r.draftId ?? null) });
  } catch (e: any) { console.error(e); return Response.json({ error: "The assistant is unavailable right now. Try again." }, { status: 500 }); }
}
