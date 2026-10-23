import { cfg } from "@/lib/config";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { redis, hasRedis } from "@/lib/redis";
import { privateIp } from "./logo";
const mem = new Map<string, { ok: boolean; at: number }>();
const TTL = 6 * 3600;
/** True when an external image URL actually loads (cached 6h). Same-origin/relative/ipfs gateway paths pass through. */
export async function imgOk(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return url.startsWith("/");
  if (/^https:\/\/[^/]+\/api\/ipfs\/[A-Za-z0-9]{20,}/.test(url) && url.startsWith(cfg.appUrl + "/")) return true; // own IPFS proxy (races gateways; can be slower than the probe timeout on a cold start)
  const m = mem.get(url); if (m && Date.now() - m.at < TTL * 1000) return m.ok;
  const key = "hcl:img:" + url.slice(0, 300);
  if (hasRedis()) { try { const v = await redis().get<string>(key); if (v === "1" || v === "0") { mem.set(url, { ok: v === "1", at: Date.now() }); return v === "1"; } } catch {} }
  const ok = await probe(url);
  mem.set(url, { ok, at: ok ? Date.now() : Date.now() - (TTL - 600) * 1000 });
  if (hasRedis()) { try { await redis().set(key, ok ? "1" : "0", { ex: ok ? TTL : 600 }); /* failures re-checked after 10 min */ } catch {} }
  return ok;
}
async function probe(url: string, hops = 0): Promise<boolean> {
  try {
    const u = new URL(url); if (u.protocol !== "https:") return false;
    const ips = isIP(u.hostname) ? [u.hostname] : (await lookup(u.hostname, { all: true })).map(a => a.address);
    if (!ips.length || ips.some(privateIp)) return false;
    const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(2500), headers: { range: "bytes=0-1023" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) return hops < 3 && probe(new URL(r.headers.get("location")!, u).toString(), hops + 1);
    r.body?.cancel().catch(() => {});
    return r.ok && (r.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  } catch { return false; }
}
/** Replace dead avatar/banner URLs with null so pages render the generated fallback instead of a broken image. */
export async function liveImages<T extends { avatar_url?: string | null; banner_url?: string | null }>(a: T): Promise<T> {
  const [av, bn] = await Promise.all([a.avatar_url ? imgOk(a.avatar_url) : false, a.banner_url ? imgOk(a.banner_url) : false]);
  return { ...a, avatar_url: av ? a.avatar_url : null, banner_url: bn ? a.banner_url : null };
}
