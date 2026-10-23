// Drives the real grammY handlers with synthetic updates; outgoing API calls are captured, nothing is sent to Telegram.
import { buildBot } from "@/lib/bots/telegram";
const MINT = process.argv[2];
const UID = 990000000 + Math.floor(Math.random() * 999);
const bot = buildBot();
bot.botInfo = { id: 1, is_bot: true, first_name: "HeyGroLaunchBot", username: "HeyGroLaunchBot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as any;
let out: string[] = [];
bot.api.config.use(async (_prev, method, payload: any) => { out.push(`${method}: ${String(payload.text ?? payload.caption ?? "").replace(/hcla_\w+/g, "hcla_***").replace(/HCL-[A-Z0-9-]+/g, "HCL-***").replace(/\|\|[^|]+\|\|/g, "||***||").slice(0, 160).replace(/\n/g, " ")}`); return { ok: true, result: { message_id: 1, date: 0, chat: { id: UID, type: "private" }, text: "" } } as any; });
const cmds = ["start", "help", "wallet", "deposit", "balance", "claim", "claimall", "mylaunches", `token ${MINT}`, "templates", "preview", "leaderboard", "airdrops", "bots", `volume ${MINT}`, "mybots", "settings", "pairs", "feed", "agents", `scan ${MINT}`, "botpay", "botverify", "exportkey", "payout", "usewallet", "withdraw", "swap", "post", "link", "new"];
let id = 1; const res: any[] = [];
for (const c of cmds) {
  out = [];
  const text = "/" + c; const ent = [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }];
  const t0 = Date.now();
  try { await bot.handleUpdate({ update_id: id++, message: { message_id: id, date: Math.floor(Date.now() / 1000), chat: { id: UID, type: "private", first_name: "Audit" }, from: { id: UID, is_bot: false, first_name: "Audit" }, text, entities: ent } } as any); }
  catch (e: any) { out.push("THROW " + e.message.slice(0, 120)); }
  const ok = out.length > 0 && !out.some(o => /THROW|Something went wrong|error/i.test(o));
  res.push({ c, ok, ms: Date.now() - t0, first: out[0] }); console.log(ok ? "PASS" : "FAIL", "/" + c, `${Date.now() - t0}ms`, out[0] ?? "(no reply)");
}
console.log("UID", UID); process.exit(0);
