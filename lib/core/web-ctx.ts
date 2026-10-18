import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { currentUser } from "@/lib/auth/session";
import { ctxForUser, type Ctx } from "./ctx";
/** Web identity: signed-in session (SIWS/X) or an anonymous browser id cookie. */
export async function webCtx(): Promise<Ctx> {
  const h = await headers(); const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const u = await currentUser();
  if (u) return { ...ctxForUser(u, "web"), ip };
  const anon = (await cookies()).get("hg_anon")?.value ?? "none";
  return { ownerKey: `anon:${createHash("sha256").update("web|" + anon).digest("hex").slice(0, 32)}`, surface: "web", ip };
}
