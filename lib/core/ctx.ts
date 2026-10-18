export type Ctx = {
  ownerKey: string;               // who owns drafts/launches: "x:<id>" | "user:<uuid>" | "tg:<id>" | "anon:<hash>"
  userId?: string;                // signed-in account (X or SIWS), undefined = anonymous
  xUserId?: string; xUsername?: string;
  walletAddress?: string;         // SIWS-verified address
  walletKey?: string;             // custodial wallet owner key when signed in ("x:<id>" or "user:<uuid>")
  surface: "mcp" | "web" | "telegram" | "test" | "api";
  agentId?: string; agentHandle?: string;
  ip?: string;
};
export function ctxForUser(u: { id: string; x_user_id?: string | null; x_username?: string | null; wallet_address?: string | null }, surface: Ctx["surface"]): Ctx {
  const walletKey = u.x_user_id ? `x:${u.x_user_id}` : `user:${u.id}`;
  return { ownerKey: walletKey, userId: u.id, xUserId: u.x_user_id ?? undefined, xUsername: u.x_username ?? undefined, walletAddress: u.wallet_address ?? undefined, walletKey, surface };
}
