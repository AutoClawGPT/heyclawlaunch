import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import { validateAuthz, getClient, redirectAllowed } from "@/lib/auth/oauth";
import { currentUser } from "@/lib/auth/session";
import SignIn from "@/components/SignIn";
import { cfg } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Authorize({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const p = await searchParams;
  const fail = (m: string) => <div className="mx-auto max-w-md p-8 card mt-16"><h1 className="display text-2xl">Can&apos;t connect</h1><p className="text-[var(--muted)] mt-2">{m}</p></div>;
  const e = validateAuthz(p as any); if (e) return fail(e);
  const client = await getClient(p.client_id); if (!client) return fail("Unknown client_id.");
  if (!redirectAllowed(client, p.redirect_uri)) return fail("redirect_uri is not registered for this client.");
  const user = await currentUser();
  const qs = new URLSearchParams(p).toString();
  if (!user) return (
    <div className="mx-auto max-w-md p-8 card mt-16 space-y-4">
      <h1 className="display text-2xl">Connect {client.client_name ?? "your AI"} to {cfg.brand}</h1>
      <p className="text-[var(--muted)] text-sm">Sign in once. Your {cfg.brand} wallet belongs to the account you sign in with.</p>
      <SignIn xEnabled={!!process.env.X_CLIENT_ID} returnTo={`/oauth/authorize?${qs}`} />
    </div>);
  const pid = randomBytes(16).toString("hex");
  await sql`insert into oauth_pending values(${pid},${sql.json(p)},now()+interval '10 minutes')`;
  const who = user.x_username ? `@${user.x_username}` : user.wallet_address;
  return (
    <form method="post" action="/oauth/authorize/approve" className="mx-auto max-w-md p-8 card mt-16 space-y-4">
      <h1 className="display text-2xl">Authorize {client.client_name ?? "this app"}?</h1>
      <p className="text-sm">It will be able to launch coins and use the {cfg.brand} wallet of <span className="mono break-all">{who}</span>, always asking you before moving funds.</p>
      <p className="text-[var(--muted)] text-xs break-all">Redirects to {p.redirect_uri}</p>
      <input type="hidden" name="pending" value={pid} />
      <div className="flex gap-2"><button name="decision" value="allow" className="btn-primary">Authorize</button><button name="decision" value="deny" className="btn-ghost">Cancel</button></div>
    </form>);
}
