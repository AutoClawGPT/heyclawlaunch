import { buildBot } from "@/lib/bots/telegram";
const bot = buildBot();
await bot.api.setMyCommands([
  { command: "quick", description: "Quick launch: AI invents name, ticker, logo" }, { command: "launch", description: "Launch a new coin" }, { command: "wallet", description: "My wallet" }, { command: "claim", description: "Claim creator fees" },
  { command: "withdraw", description: "Withdraw SOL/tokens" }, { command: "swap", description: "Buy / sell tokens" }, { command: "pairs", description: "List pair assets" },
  { command: "link", description: "Link this Telegram to your web account" }, { command: "new", description: "Reset the conversation" },
]);
await bot.api.setMyDescription(`Launch a pump.fun coin by chatting. No wallet, no signing, no dev buy. (${process.env.SOLANA_CLUSTER ?? "devnet"} test build)`);
await bot.api.deleteWebhook();
console.log("bot @" + (await bot.api.getMe()).username + " polling");
bot.start({ drop_pending_updates: false });
