import { currentUser } from "@/lib/auth/session";
import Scanner from "@/components/hcl/Scanner";
import { PageHead } from "@/components/hcl/ui";
import { ogMeta } from "@/lib/og";
export const dynamic = "force-dynamic";
export const metadata = ogMeta("Scanner", "Paste any Solana wallet: coins it launched, fees earned, claimable and claimed.", "type=home");
export default async function Page({ searchParams }: { searchParams: Promise<{ wallet?: string }> }) {
  const u = await currentUser(); const w = (await searchParams).wallet;
  return <main><PageHead eyebrow="Scanner · on-chain" title={<>What did this<br /><span className="text-grad">wallet launch?</span></>} sub="Coins launched, creator fees earned, claimable right now and already claimed. Real on-chain data." /><div className="wrap pb-16"><Scanner initial={w ?? u?.wallet_address ?? ""} connected={u?.wallet_address ?? null} /></div></main>;
}
