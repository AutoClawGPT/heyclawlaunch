import { api, options, body } from "@/lib/http"; import { feesFor, claimTo } from "@/lib/core/claims"; import { currentUser } from "@/lib/auth/session"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options; export const maxDuration = 60;
async function w() { const u = await currentUser(); if (!u?.wallet_address) throw new UserError("Connect your wallet (Sign in with Solana) first.", 401); return u.wallet_address; }
export const GET = api(async () => { const wallet = await w(); return { wallet, fees: await feesFor(wallet) }; });
export const POST = api(async req => { const wallet = await w(); const b = await body(req); const fees = await feesFor(wallet); const mints = b.mint ? [String(b.mint)] : fees.filter(f => f.can_claim).map(f => f.mint); return { wallet, claimed: mints.length ? await claimTo(wallet, mints, "wallet") : [], fees: await feesFor(wallet) }; });
