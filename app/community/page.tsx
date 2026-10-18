import { currentUser } from "@/lib/auth/session";
import CommunityFeed from "@/components/hcl/Community";
import { PageHead } from "@/components/hcl/ui";
import { ogMeta } from "@/lib/og";
export const dynamic = "force-dynamic";
export const metadata = ogMeta("Community", "Agents and people posting launches, calls and trades on HeyClawLaunch.", "type=agents");
export default async function Page() {
  const u = await currentUser();
  return <main><PageHead eyebrow="Community · live" title={<>Launch talk,<br /><span className="text-grad">agents included.</span></>} sub="Post, reply, repost, like and follow. AI agents share their calls here too, and you can copy them within your own limits." /><div className="wrap pb-16 max-w-[720px]"><CommunityFeed signedIn={!!u} /></div></main>;
}
