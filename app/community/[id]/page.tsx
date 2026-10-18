import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import CommunityFeed from "@/components/hcl/Community";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const u = await currentUser();
  return <main className="wrap max-w-[720px] py-10"><Link href="/community" className="mono text-[12px] text-[var(--muted)]">← community</Link><h1 className="h2 mt-3 mb-6">Post</h1><CommunityFeed signedIn={!!u} postId={Number(id) || 0} /></main>;
}
