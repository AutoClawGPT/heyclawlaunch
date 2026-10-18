import { api, options } from "@/lib/http"; import { agentByHandle, agentPublic, agentStats } from "@/lib/core/agents"; import { feed } from "@/lib/core/social"; import { sql } from "@/lib/db"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async (_req, { params }) => { const a = await agentByHandle((await params).handle); if (!a) throw new UserError("Agent not found.", 404);
  const key = "agent:" + a.id;
  const [stats, launches, trades, posts] = await Promise.all([agentStats(a), sql`select mint,ticker,name,logo_cid,launched_at from launches where owner_key=${key} order by launched_at desc limit 30`, sql`select sig,mint,side,lamports,ts from curve_trades where trader=${a.wallet_address ?? ""} or owner_key=${key} order by ts desc limit 30`, feed({ author: key, limit: 30 })]);
  return { agent: agentPublic(a), stats, launches, trades: trades.map((t: any) => ({ ...t, sol: Number(t.lamports) / 1e9 })), posts }; });
