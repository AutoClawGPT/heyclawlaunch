import { PublicKey } from "@solana/web3.js";
import { currentUser } from "@/lib/auth/session";
import { webCtx } from "@/lib/core/web-ctx";
import { getOrCreateCustodial } from "@/lib/keystore";
import { conn } from "@/lib/solana";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser(); if (!u) return Response.json({ signedIn: false });
  const ctx = await webCtx(); const w = await getOrCreateCustodial(ctx.walletKey!);
  const bal = await conn().getBalance(new PublicKey(w)).catch(() => 0);
  return Response.json({ signedIn: true, user: { id: u.id, x: u.x_username, wallet: u.wallet_address, telegram: !!u.telegram_id }, custodial: w, balance: bal / 1e9 });
}
