import { buildBot, COMMANDS } from "@/lib/bots/telegram";
const bot = buildBot();
await bot.api.setMyCommands(COMMANDS.map(([command, description]) => ({ command, description })));
await bot.api.setMyDescription(`Launch a pump.fun coin by chatting. No wallet, no signing, no dev buy. (${process.env.SOLANA_CLUSTER ?? "devnet"} test build)`);
await bot.api.deleteWebhook();
console.log("bot @" + (await bot.api.getMe()).username + " polling");
bot.start({ drop_pending_updates: false });
