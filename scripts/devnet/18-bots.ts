// Simulated Telegram updates through the real bot handlers + real brain; outgoing Bot API calls are captured (nothing is sent).
import { buildBot } from "@/lib/bots/telegram";
import { Keypair } from "@solana/web3.js";
import { report } from "./lib";
const bot = buildBot();
bot.botInfo = { id: 1, is_bot: true, first_name: "HeyGro", username: "HeyGroLaunchBot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as any;
const out: { method: string; payload: any }[] = [];
bot.api.config.use(async (_prev, method, payload: any) => { out.push({ method, payload }); return { ok: true, result: method === "sendMessage" ? { message_id: out.length, date: 0, chat: { id: payload.chat_id, type: "private" }, text: payload.text } : true } as any; });
const A = 900000000 + Math.floor(Math.random() * 1e6), B = A + 1; let uid = 1;
const msg = (from: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: A, type: "private" }, from: { id: from, is_bot: false, first_name: "T" }, text } } as any);
const cb = (from: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: { id: from, is_bot: false, first_name: "T" }, chat_instance: "x", data, message: { message_id: 1, date: 0, chat: { id: A, type: "private" } } } } as any);
const dest = Keypair.generate().publicKey.toBase58();
await msg(A, `Launch a coin: name "TG Bot Test", ticker TGBT, logo ipfs://bafkreidlp6sdj6jkroakvmbntpy2clsj77foijheae5byt3iwz7d2k542a, fees to wallet ${dest}, pair SOL, no description, no links.`);
let tries = 0;
const findButton = () => out.map(o => o.payload?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).filter(Boolean).pop();
while (!findButton() && tries++ < 3) await msg(A, "yes, launch it");
const data = findButton();
const replies = out.filter(o => o.method === "sendMessage").map(o => o.payload.text.replace(/\n/g, " | ").slice(0, 160));
if (!data) { report("18-bots", false, `no confirm button; replies: ${replies.join(" // ")}`); process.exit(1); }
const n0 = out.length;
await cb(B, data);
const alertB = out.slice(n0).find(o => o.method === "answerCallbackQuery");
await cb(A, data);
const live = out.slice(n0).filter(o => o.method === "sendMessage").map(o => o.payload.text).join("\n");
report("18-bots", !!alertB?.payload?.show_alert && /only the person/i.test(alertB.payload.text) && live.includes("is live!"), `button ${data}; other user B → "${alertB?.payload?.text}"; owner A → ${live.replace(/\n/g, " | ").slice(0, 260)}`);
process.exit(0);
