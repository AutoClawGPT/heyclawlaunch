import { indexTradesOnce, candles } from "@/lib/core/leaderboard";
console.log("indexed", await indexTradesOnce(40)); console.log(JSON.stringify((await candles(process.argv[2], 60)).slice(-3))); process.exit(0);
