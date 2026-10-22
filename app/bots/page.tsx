import BotsClient from "@/components/hcl/BotsClient";
import { PageHead } from "@/components/hcl/ui";
export const metadata = { title: "Volume Bots" };
export default function Page() { return <main><PageHead eyebrow="Volume bots · devnet" title={<>Give your coin<br /><span className="text-grad">a heartbeat.</span></>} sub="Volume, bump, buy, sell and holder bots for coins launched on HeyClawLaunch. Pay a package in devnet SOL from your wallet, watch every transaction land live on the bonding curve." art="/art/section-bots.jpg" /><div className="wrap pb-10"><BotsClient /></div></main>; }
