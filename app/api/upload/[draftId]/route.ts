import { checkUploadToken } from "@/lib/core/drafts";
import { pinLogoBytes } from "@/lib/core/logo";
import { UserError } from "@/lib/core/validate";
import { sql } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params; const t = new URL(req.url).searchParams.get("t") ?? "";
  try {
    const d = await checkUploadToken(draftId, t);
    const f = (await req.formData()).get("file");
    if (!(f instanceof Blob)) throw new UserError("Attach an image file.");
    const cid = await pinLogoBytes(new Uint8Array(await f.arrayBuffer()));
    await sql`update drafts set logo_cid=${cid}, updated_at=now() where id=${d.id}`;
    return Response.json({ ok: true, cid, url: `/api/ipfs/${cid}` });
  } catch (e: any) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: e.message.includes("expired") || e.message.includes("Invalid") ? 401 : 400 });
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
