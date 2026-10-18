import { PublicKey } from "@solana/web3.js";
export class UserError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const isNothing = (s?: string) => !!s && /^(nothing|none|no|skip|n\/a|-|gak ada|nope)$/i.test(s.trim());
export function vName(s: string) { s = s.trim(); if (!s) throw new UserError("The name can't be empty."); if (s.length > 32) throw new UserError("The name must be 32 characters or less."); return s; }
export function vTicker(s: string) { s = s.trim().replace(/^\$/, "").toUpperCase(); if (!/^[A-Z0-9]{1,10}$/.test(s)) throw new UserError("The ticker must be 1–10 letters or digits (e.g. DOGE)."); return s; }
export function vDesc(s: string) { if (isNothing(s)) return ""; s = s.trim(); if (s.length > 1000) throw new UserError("The description must be 1000 characters or less."); return s; }
export function vWebsite(s: string) { if (isNothing(s)) return ""; s = s.trim(); if (!/^https?:\/\//i.test(s)) s = "https://" + s; let u: URL; try { u = new URL(s); } catch { throw new UserError("That website isn't a valid URL."); } if (u.protocol !== "https:") throw new UserError("Website must use https://."); return u.toString(); }
export function vX(s: string) { if (isNothing(s)) return ""; s = s.trim(); const m = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i) ?? s.match(/^@?([A-Za-z0-9_]{1,15})$/); if (!m) throw new UserError("That X handle/link isn't valid."); return `https://x.com/${m[1]}`; }
export function vTelegram(s: string) { if (isNothing(s)) return ""; s = s.trim(); const m = s.match(/^(?:https?:\/\/)?t\.me\/([A-Za-z0-9_+\/-]{3,64})/i) ?? s.match(/^@?([A-Za-z0-9_]{5,32})$/); if (!m) throw new UserError("That Telegram handle/link isn't valid."); return `https://t.me/${m[1]}`; }
export function vHandle(s: string) { const m = s.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i) ?? s.trim().match(/^@?([A-Za-z0-9_]{1,15})$/); if (!m) throw new UserError("That X handle isn't valid (e.g. @name)."); return m[1]; }
export function vAddress(s: string) {
  let pk: PublicKey; try { pk = new PublicKey(s.trim()); } catch { throw new UserError("That isn't a valid Solana address."); }
  if (!PublicKey.isOnCurve(pk.toBytes())) throw new UserError("That address is a program/PDA, not a wallet. Give a normal Solana wallet address.");
  return pk.toBase58();
}
