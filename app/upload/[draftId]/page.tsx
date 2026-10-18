import Upload from "@/components/Upload";
import { checkUploadToken } from "@/lib/core/drafts";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ draftId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { draftId } = await params; const { t = "" } = await searchParams;
  let err = "", name = "";
  try { if (!/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error("This upload link is invalid or has expired. Ask Claw for a new one."); const d = await checkUploadToken(draftId, t); name = d.name ?? ""; } catch (e: any) { err = e.message; }
  return <main className="wrap py-14 sm:py-20"><div className="mx-auto max-w-md card space-y-4 p-8"><div className="eyebrow"><span className="live-dot"></span>Logo upload</div><h1 className="h2 !text-[30px]">Upload the logo{name ? <> for <span className="text-grad">{name}</span></> : ""}</h1>{err ? <p className="down text-[14px]">{err}</p> : <><p className="text-[14px] text-[var(--muted)]">PNG, JPEG, GIF or WEBP, max 5 MB.</p><Upload draftId={draftId} token={t} /></>}</div></main>;
}
