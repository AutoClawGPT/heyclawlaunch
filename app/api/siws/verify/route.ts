import { verifySiws } from "@/lib/auth/siws";
import { currentUser, upsertWalletUser, createSession, sessionCookie } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const v = await verifySiws(b);
  if (!v.ok) return Response.json({ error: v.error }, { status: 401 });
  const u = await upsertWalletUser(v.address, await currentUser());
  const token = await createSession(u.id);
  return Response.json({ ok: true, address: v.address }, { headers: { "set-cookie": sessionCookie(token) } });
}
