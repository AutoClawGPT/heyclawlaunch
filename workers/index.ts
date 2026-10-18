// Background worker: split-sender (retries tx 2), pairs sync, payer monitor. Run: pnpm worker
import { sql } from "@/lib/db";
import { runSplit } from "@/lib/core/launch";
import { syncPairs } from "@/lib/core/pairs";
import { conn, launchWallet } from "@/lib/solana";
import { cfg } from "@/lib/config";
import { indexTradesOnce, runAirdropsOnce } from "@/lib/core/leaderboard";
import { botTickOnce } from "@/lib/core/bots";
import { hasRedis } from "@/lib/redis";
/** setInterval that never overlaps itself. */
function every(ms: number, name: string, fn: () => Promise<any>) { let busy = false; const run = async () => { if (busy) return; busy = true; try { const r = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timed out after 90s`)), 90_000))]) as any; if (r && (Array.isArray(r) ? r.length : (r.ran || r > 0))) console.log(`[${name}]`, JSON.stringify(r).slice(0, 300)); } catch (e: any) { console.error(`[${name}]`, e?.message ?? e); } finally { busy = false; } }; run(); return setInterval(run, ms); }
export async function splitSenderOnce() {
  const rows = await sql`select id from launches where split_status='pending' and split_attempts < 20 order by launched_at limit 10`;
  const res = []; for (const r of rows) res.push(await runSplit(r.id)); return res;
}
export async function payerMonitorOnce() {
  const bal = await conn().getBalance(launchWallet().publicKey);
  const alertAt = Number(process.env.PAYER_ALERT_LAMPORTS ?? 250_000_000);
  if (bal < alertAt) { console.warn(`[payer] launch wallet low: ${bal / 1e9} SOL`); if (process.env.ALERT_WEBHOOK_URL) await fetch(process.env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `${cfg.brand} launch wallet low: ${bal / 1e9} SOL` }) }).catch(() => {}); }
  return bal;
}
if (process.argv[1]?.includes("workers/index")) {
  const once = process.argv.includes("--once");
  const tick = async () => { try { const s = await splitSenderOnce(); if (s.length) console.log("[split]", s.map((x: any) => `${x.mint}:${x.split_status}`).join(" ")); } catch (e) { console.error(e); } };
  await tick(); await syncPairs().catch(console.error); await payerMonitorOnce().catch(console.error);
  if (once) process.exit(0);
  setInterval(tick, 5000); setInterval(() => syncPairs().catch(console.error), 600_000); setInterval(() => payerMonitorOnce().catch(console.error), 60_000);
  if (hasRedis()) { every(5_000, "index", () => indexTradesOnce()); every(60_000, "airdrop", () => runAirdropsOnce()); }
  every(6_000, "bots", () => botTickOnce());
  console.log("worker running");
}
