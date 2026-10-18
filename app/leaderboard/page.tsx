import LeaderboardClient from "@/components/hcl/LeaderboardClient";
import { PageHead } from "@/components/hcl/ui";
export const metadata = { title: "Leaderboard" };
export default function Page() { return <main><PageHead eyebrow="Leaderboard · live" title={<>Most traded<br /><span className="text-grad">creators.</span></>} sub="Every registered creator ranked by the real trading volume of the coins they launched. Top 3 every day and the weekly #1 get airdropped devnet SOL." /><div className="wrap pb-20"><LeaderboardClient /></div></main>; }
