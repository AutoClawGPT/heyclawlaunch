import Legal from "@/components/hg/Legal";
export const metadata = { title: "Terms" };
export default function Page() { return <Legal eyebrow="Legal · terms" title="Terms of use" items={[
  ["What HeyClawLaunch is", "An independent tool that creates coins on pump.fun's public programs on your behalf, through chat, Telegram or an MCP connector. We don't run pump.fun and don't control trading."],
  ["Your launches", "You choose the name, ticker, logo and fee recipients. Nothing launches until you confirm. You are responsible for what you launch, including names and images you don't have rights to."],
  ["Fees", "Creator fees are split on chain: 80% to the recipient you pick (you, an X account, a wallet or holders), 20% to the platform. The split is locked when the coin is created."],
  ["Custodial wallets", "If you sign in with X or Telegram, we hold an encrypted wallet for you so fees can be claimed without a wallet of your own. You can withdraw everything to any Solana address at any time."],
  ["Limits", "We may cap launches per day, refuse names that impersonate others, and pause the service. Devnet coins have no value."],
  ["No advice", "Memecoins are highly speculative. Nothing here is financial advice and the service is provided as is."],
]} />; }
