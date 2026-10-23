// Calls all 22 MCP tools as a real client (bearer). Output: pass/fail log, secrets redacted.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "fs";
const BASE = process.env.BASE ?? "https://heyclawlaunch.vercel.app";
const PATH = process.env.MCP_PATH ?? "/mcp";
const KEY = JSON.parse(fs.readFileSync("/workspace/audit2/reg.json", "utf8")).api_key;
const red = (s: string) => s.replace(/hcla_[A-Za-z0-9_-]+/g, "hcla_***").replace(/HCL-[A-Z0-9-]+/g, "HCL-***");
const c = new Client({ name: "audit2", version: "1" });
await c.connect(new StreamableHTTPClientTransport(new URL(BASE + PATH), { requestInit: { headers: { Authorization: `Bearer ${KEY}` } } }));
const out: any = {};
async function call(name: string, args: any) {
  try {
    const r: any = await c.callTool({ name, arguments: args });
    const t = r.content?.map((x: any) => x.text ?? "").join(" ") ?? "";
    out[name] = t;
    console.log(r.isError ? "FAIL" : "PASS", name, red(t).slice(0, 260).replace(/\n/g, " "));
    return r.structuredContent ?? (() => { try { return JSON.parse(t); } catch { return t; } })();
  } catch (e: any) { console.log("ERR ", name, e.message.slice(0, 200)); }
}
const me: any = await call("my_wallet", {}); const myAddr = me?.address ?? String(out.my_wallet).match(/wallet: (\w{32,44})/)?.[1];
await call("list_pairs", {});
await call("list_templates", {});
const tpl = String(out.list_templates).match(/• (\w+):/)?.[1];
await call("use_template", { template_id: tpl ?? "x" });
await call("generate_token_idea", { theme: "audit crab" });
const d1: any = await call("prepare_launch", { start_new: true, name: "Audit Crab", ticker: "ACRAB", description: "Audit test coin on devnet.", logo_url: "https://picsum.photos/seed/crab/400", skip_socials: true, pair: "SOL", fee_mode: "wallet", fee_wallet: myAddr });
const did = d1?.draft_id ?? String(out.prepare_launch).match(/draft_id: ([0-9a-f-]{36})/)?.[1];
await call("get_logo_upload_link", { draft_id: did });
await call("generate_logo", { prompt: "a cartoon crab with a magnifying glass", draft_id: did, apply_to_draft: false });
const d2: any = await call("prepare_launch", { draft_id: did });
await call("launch_status", { draft_id: did });
if (process.env.LAUNCH === "1") {
  const L: any = await call("confirm_launch", { draft_id: did, user_confirmed: true });
  fs.writeFileSync("/workspace/audit2/launch.json", JSON.stringify(L ?? out.confirm_launch));
} else console.log("SKIP confirm_launch (LAUNCH!=1)");
await call("my_launches", {});
await call("claim_fees", {});
await call("withdraw", { to: "11111111111111111111111111111111", amount: "0.001" });
await call("swap", { to: "USDC", amount: "0.001" });
await call("leaderboard", { period: "daily" });
const mint = JSON.parse(fs.existsSync("/workspace/audit2/launch.json") ? fs.readFileSync("/workspace/audit2/launch.json", "utf8") || "{}" : "{}")?.mint ?? process.env.MINT;
const vb: any = await call("volume_bot", { mint, kind: "volume", package: "v-02", confirm: true, pay: "external" });
const oid = vb?.order_id ?? String(out.volume_bot).match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0];
await call("bot_payment", { order_id: oid ?? "00000000-0000-0000-0000-000000000000" });
const p: any = await call("community_post", { body: "audit2 test post (will be deleted)" });
const pid = p?.id ?? Number(String(out.community_post).match(/#(\d+)/)?.[1]);
await call("community_post", { body: "audit2 reply", reply_to: pid });
await call("community_post", { repost_of: pid });
await call("community_feed", { tab: "all" });
await call("a2a_broadcast", { side: "buy", mint: mint ?? "So11111111111111111111111111111111111111112", amount_sol: 0.01, note: "audit2" });
await call("a2a_subscribe", { agent: "audit2_peer" , autotrade: false });
await call("a2a_subscribe", { agent: "audit2_peer", unsubscribe: true });
await call("a2a_inbox", {});
fs.writeFileSync("/workspace/audit2/mcp-out.json", red(JSON.stringify(out, null, 1)));
await c.close(); process.exit(0);
