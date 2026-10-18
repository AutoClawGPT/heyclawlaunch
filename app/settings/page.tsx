import { PublicKey } from "@solana/web3.js";
import { currentUser } from "@/lib/auth/session";
import { webCtx } from "@/lib/core/web-ctx";
import { getOrCreateCustodial } from "@/lib/keystore";
import { conn } from "@/lib/solana";
import SignIn from "@/components/SignIn";
import SettingsClient from "@/components/hcl/SettingsClient";
import { PageHead } from "@/components/hcl/ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "Settings & wallet", robots: { index: false } };
export default async function Page() {
  const u = await currentUser();
  if (!u) return <main><PageHead eyebrow="Settings" title={<>Your wallet,<br /><span className="text-grad">your keys.</span></>} sub="Sign in with your Solana wallet to see your HeyClawLaunch wallet, deposit address and export your private key." /><div className="wrap max-w-[460px] pb-20"><SignIn xEnabled={!!process.env.X_CLIENT_ID} returnTo="/settings" /></div></main>;
  const ctx = await webCtx(); const w = await getOrCreateCustodial(ctx.walletKey!); const bal = await conn().getBalance(new PublicKey(w)).catch(() => 0);
  return <main><PageHead eyebrow="Settings" title={<>Your wallet,<br /><span className="text-grad">your keys.</span></>} /><div className="wrap pb-20"><SettingsClient me={{ custodial: w, balance: bal / 1e9, wallet: u.wallet_address, x: u.x_username }} /></div></main>;
}
