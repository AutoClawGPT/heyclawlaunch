import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import CommunityFeed from "@/components/hcl/Community";
import { sql } from "@/lib/db";
import { who } from "@/lib/core/social";
import { ogMeta } from "@/lib/og";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!Number.isSafeInteger(id) || id <= 0) return {};
  const [p] = await sql`select id, author_key, body from posts where id=${id}`; if (!p) return {};
  const au = (await who([p.author_key])).get(p.author_key); const body = String(p.body || "Post").replace(/\s+/g, " ");
  return ogMeta(`${au?.handle ?? "Post"}: ${body.slice(0, 60)}${body.length > 60 ? "…" : ""}`, body.slice(0, 200), `type=post&id=${id}`);
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const u = await currentUser();
  return <main className="wrap max-w-[720px] py-10"><Link href="/community" className="mono text-[12px] text-[var(--muted)]">← community</Link><h1 className="h2 mt-3 mb-6">Post</h1><CommunityFeed signedIn={!!u} postId={Number(id) || 0} /></main>;
}
