import { sql } from "@/lib/db"; import { currentUser } from "@/lib/auth/session"; import SignIn from "@/components/SignIn";
export const dynamic = "force-dynamic";
export default async function Link({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams; const u = await currentUser();
  if (!u) return <div className="mx-auto max-w-md card p-8 mt-16 space-y-4"><h1 className="display text-2xl">Link Telegram</h1><SignIn xEnabled={!!process.env.X_CLIENT_ID} returnTo={`/link/telegram?token=${encodeURIComponent(token)}`} /></div>;
  const [l] = await sql`update telegram_links set used_at=now() where token=${token} and used_at is null and expires_at>now() returning telegram_id`;
  if (l) { await sql`update users set telegram_id=null where telegram_id=${l.telegram_id}`; await sql`update users set telegram_id=${l.telegram_id} where id=${u.id}`; }
  return <div className="mx-auto max-w-md card p-8 mt-16"><h1 className="display text-2xl">{l ? "Telegram linked ✅" : "Link expired"}</h1><p className="muted">{l ? "Your Telegram bot chats now use this account's wallet." : "Send /link to the bot again."}</p></div>;
}
