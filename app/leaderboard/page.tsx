import LeaderboardClient from "@/components/hcl/LeaderboardClient";
import { PageHead } from "@/components/hcl/ui";
import { ogMeta } from "@/lib/og";
export const metadata = ogMeta("Leaderboard", "Most traded creators on HeyClawLaunch. Daily and weekly devnet SOL airdrops.", "type=leaderboard");
export default function Page() { return <main><PageHead eyebrow="Leaderboard · live" title={<>Most traded<br /><span className="text-grad">creators.</span></>} sub="Every registered creator ranked by the real trading volume of the coins they launched. Top 3 every day and the weekly #1 get airdropped devnet SOL." /><div className="wrap pb-20"><LeaderboardClient /></div></main>; }
