import { Redis } from "@upstash/redis";
const g = globalThis as any;
/** Accepts the REST URL, or a redis://… / `redis-cli --tls -u redis://…` string (derives https://<host>). */
export function restUrl(raw = process.env.UPSTASH_REDIS_REST_URL ?? "") { if (raw.startsWith("https://")) return raw; const m = raw.match(/@([^:/\s]+)(?::\d+)?/); return m ? `https://${m[1]}` : raw; }
export const redis = (): Redis => (g.__redis ??= new Redis({ url: restUrl(), token: process.env.UPSTASH_REDIS_REST_TOKEN! }));
export const hasRedis = () => restUrl().startsWith("https://") && !!process.env.UPSTASH_REDIS_REST_TOKEN;
