import Legal from "@/components/hg/Legal";
export const metadata = { title: "Privacy" };
export default function Page() { return <Legal eyebrow="Legal · privacy" title="Privacy" items={[
  ["What we store", "Your sign-in identity (wallet address, X handle or Telegram id), your launch drafts, coins you launched and the public on-chain data about them."],
  ["Keys", "Custodial wallet keys are encrypted with AES-256-GCM before they touch the database and are only decrypted to sign transactions you asked for."],
  ["Chat", "Messages are sent to our language model provider to understand your request. Images you generate are sent to the image provider and pinned publicly on IPFS."],
  ["Public by design", "Coin names, logos, mints and fee recipients are public on Solana and IPFS and can't be deleted."],
  ["Cookies", "One session cookie keeps you signed in. No ad trackers."],
  ["Contact", "Reach us through the Telegram bot for data questions or deletion of off-chain records."],
]} />; }
