import { limitIp } from "@/lib/ratelimit";
// Private-key export: needs a signed-in session AND a fresh re-auth (a new SIWS signature from the same wallet,
// or for X-only accounts a session created in the last 10 minutes). Returns the key once, never cached or logged.
import bs58 from "bs58";
import { currentUser } from "@/lib/auth/session";
import { newSiwsInput, messageText, verifySiws } from "@/lib/auth/siws";
import { webCtx } from "@/lib/core/web-ctx";
import { getOrCreateCustodial, withCustodialSigner } from "@/lib/keystore";
import { sql } from "@/lib/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const H = { "cache-control": "no-store, private", "x-robots-tag": "noindex" };
export async function POST(req: Request) { { const busy = await limitIp(req, "export", 10, 600); if (busy) return busy; }
  const u = await currentUser(); if (!u) return Response.json({ error: "Sign in first." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({})); const ctx = await webCtx();
  if (b.step === "challenge") {
    if (!u.wallet_address) { const [s] = await sql`select max(created_at) t from sessions where user_id=${u.id}`.catch(() => [{ t: null }]); return Response.json({ mode: "recent", ok: !!s?.t && Date.now() - +new Date(s.t) < 10 * 60_000 }, { headers: H }); }
    const input = await newSiwsInput(); const statement = "Export my HeyClawLaunch wallet private key. I understand anyone with this key controls the wallet.";
    const full = { ...input, statement, address: u.wallet_address };
    return Response.json({ mode: "siws", input: full, text: messageText(full) }, { headers: H });
  }
  if (b.step !== "reveal" || b.i_understand !== true) return Response.json({ error: "Confirm the warning first." }, { status: 400, headers: H });
  if (u.wallet_address) {
    const v = await verifySiws({ address: b.address, signedMessage: b.signedMessage, signature: b.signature });
    if (!v.ok || v.address !== u.wallet_address) return Response.json({ error: "Re-authentication failed: sign with the wallet you signed in with." }, { status: 401, headers: H });
  } else {
    const [s] = await sql`select max(created_at) t from sessions where user_id=${u.id}`.catch(() => [{ t: null }]);
    if (!s?.t || Date.now() - +new Date(s.t) > 10 * 60_000) return Response.json({ error: "Sign in again (within the last 10 minutes) to export your key." }, { status: 401, headers: H });
  }
  const address = await getOrCreateCustodial(ctx.walletKey!);
  const secret = await withCustodialSigner(ctx.walletKey!, async kp => bs58.encode(kp.secretKey));
  await sql`insert into audit_log(actor,action,detail) values(${ctx.walletKey},'export_key',${JSON.stringify({ address, surface: "web" })})`;
  return Response.json({ address, secret, format: "base58 (Phantom / Solflare / Backpack: Import private key)" }, { headers: H });
}
