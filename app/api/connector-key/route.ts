import { limitIp } from "@/lib/ratelimit";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db"; import { currentUser } from "@/lib/auth/session"; import { sha } from "@/lib/core/drafts"; import { cfg } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { { const busy = await limitIp(req, "ckey", 20, 600); if (busy) return busy; }
  const u = await currentUser(); if (!u) return Response.json({ error: "Sign in first" }, { status: 401 });
  const t = "hgk_" + randomBytes(32).toString("base64url");
  await sql`insert into connector_keys(user_id,token_hash) values(${u.id},${sha(t)})`;
  return Response.json({ url: `${cfg.appUrl}/mcp?key=${t}` });
}
export async function DELETE() { const u = await currentUser(); if (!u) return Response.json({ error: "Sign in first" }, { status: 401 }); await sql`update connector_keys set revoked_at=now() where user_id=${u.id} and revoked_at is null`; return Response.json({ ok: true }); }
