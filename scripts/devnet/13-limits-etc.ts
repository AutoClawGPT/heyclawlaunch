import { sql } from "@/lib/db";
import { runTool } from "@/lib/tools/run";
import { launchWallet, conn } from "@/lib/solana";
import { readFileSync } from "fs";
import { toolDefs } from "@/lib/tools/defs";
import { z } from "zod";
import { report } from "./lib";
const LOGO = "ipfs://bafkreidlp6sdj6jkroakvmbntpy2clsj77foijheae5byt3iwz7d2k542a";
const ctx = { ownerKey: `test:lim-${Date.now()}`, surface: "test" as const, ip: `10.0.0.${Date.now() % 250}` };
async function fullDraft(c: any, name: string, extra: any = { fee_mode: "holders" }) {
  const r = await runTool(c, "prepare_launch", { start_new: true, name, ticker: name.replace(/\W/g, "").slice(0, 8), logo_url: LOGO, ...extra, pair: "SOL", description: "nothing", skip_socials: true });
  return r.data!.draft_id as string;
}
// 05 holders + 13 limits (3/day, 4th refused)
const mints: string[] = []; let fourth = "";
const hid = await fullDraft(ctx, "Holders Test");
const hr = await runTool(ctx, "confirm_launch", { draft_id: hid, user_confirmed: true });
report("05-create-holders", false, `BLOCKED on devnet: pump global has holder rewards disabled (program error 6084 HolderRewardDisabled). User-facing message: "${hr.text}". Limit counter released: ${!(await sql`select 1 from launches where draft_id=${hid}`).length}`);
const { Keypair } = await import("@solana/web3.js");
for (let i = 1; i <= 4; i++) {
  const id = await fullDraft(ctx, `Limit Test ${i}`, { fee_mode: "wallet", fee_wallet: Keypair.generate().publicKey.toBase58() });
  const r = await runTool(ctx, "confirm_launch", { draft_id: id, user_confirmed: true });
  if (i < 4) mints.push((r.data as any)?.mint ?? `ERR ${r.text}`); else fourth = r.text;
}
console.log(mints, fourth);
report("13-limits", mints.every(m => !m.startsWith("ERR")) && /limit/i.test(fourth) && fourth.includes("00:00 UTC"), `3 launches ok (${mints.join(", ")}); 4th: "${fourth}"`);
// 14 payer low
process.env.LAUNCH_MIN_LAMPORTS = String((await conn().getBalance(launchWallet().publicKey)) + 1);
const { cfg } = await import("@/lib/config"); (cfg as any).launchMin = Number(process.env.LAUNCH_MIN_LAMPORTS);
const ctx2 = { ownerKey: `test:low-${Date.now()}`, surface: "test" as const };
const id2 = await fullDraft(ctx2, "Payer Low");
const before = await conn().getBalance(launchWallet().publicKey);
const low = await runTool(ctx2, "confirm_launch", { draft_id: id2, user_confirmed: true });
report("14-payer-low", low.isError === true && low.text.includes("Launch wallet is low on SOL") && (await conn().getBalance(launchWallet().publicKey)) === before, `floor set above balance → "${low.text}", nothing sent`);
// golden schema diff vs PLAN1 §4.3
const plan = readFileSync("/workspace/heygrok-clone/PLAN1.md", "utf8");
const golden: Record<string, any> = {};
for (const m of plan.matchAll(/#### `(\w+)`[\s\S]*?```json\n([\s\S]*?)```/g)) golden[m[1]] = JSON.parse(m[2]);
const norm = (s: any): any => JSON.stringify(s, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);
const diffs: string[] = [];
for (const [n, d] of Object.entries(toolDefs())) {
  const ours: any = z.toJSONSchema(z.object((d as any).inputSchema), { io: "input" }); delete ours.additionalProperties;
  if (!ours.required?.length) delete ours.required;
  if (norm(ours) !== norm(golden[n])) diffs.push(`${n}: ours=${norm(ours).slice(0, 200)} golden=${norm(golden[n]).slice(0, 200)}`);
}
report("11h-schema-golden", diffs.length === 0 && Object.keys(golden).length === 10, diffs.length ? diffs.join(" ;; ") : "all 10 input schemas identical to HeyGrok (PLAN1 §4.3)");
process.exit(0);
