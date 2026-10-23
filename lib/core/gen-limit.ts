import type { Ctx } from "./ctx";
import { UserError } from "./validate";
import { hasRedis, redis } from "@/lib/redis";
/** Image/idea generation costs money: cap it per network and per identity (hourly). */
export async function genLimit(ctx: Ctx) {
  if (!hasRedis()) return;
  const hr = new Date().toISOString().slice(0, 13);
  const keys: [string, number][] = [[`hcl:gen:id:${ctx.agentId ?? ctx.walletKey ?? ctx.ownerKey}:${hr}`, 30]];
  if (ctx.ip && ctx.ip !== "local") keys.push([`hcl:gen:ip:${ctx.ip}:${hr}`, 60]);
  for (const [k, max] of keys) { const n = await redis().incr(k); if (n === 1) await redis().expire(k, 3700); if (n > max) throw new UserError("Image generation limit reached for this hour. Try again later, or paste a logo link.", 429); }
}
