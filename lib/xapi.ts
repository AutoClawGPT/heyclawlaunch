import { sql } from "@/lib/db";
import { UserError } from "@/lib/core/validate";
/** Resolve an X handle to its numeric id. Requires X_BEARER_TOKEN (pay-per-use). DEV_X_STUB=1 maps handles to "stub-<handle>" for local tests. */
export async function resolveXHandle(handle: string): Promise<string> {
  const h = handle.toLowerCase();
  const [c] = await sql`select x_user_id from x_handles where handle=${h} and resolved_at > now() - interval '24 hours'`;
  if (c) return c.x_user_id;
  let id: string;
  if (process.env.X_BEARER_TOKEN) {
    const r = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`, { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } });
    const j: any = await r.json();
    if (!j?.data?.id) throw new UserError(`I couldn't find the X account @${handle}.`);
    id = j.data.id;
  } else if (process.env.DEV_X_STUB === "1") id = `stub-${h}`;
  else throw new UserError("Fees to an X account aren't available on this server (no X API configured). Choose a Solana wallet or holders instead.");
  await sql`insert into x_handles(handle,x_user_id) values(${h},${id}) on conflict(handle) do update set x_user_id=excluded.x_user_id, resolved_at=now()`;
  return id;
}
