import { limitIp } from "@/lib/ratelimit";
import { apiCtx } from "@/lib/core/agents";
import { KINDS, botMarkets, botFeed, myBotOrders, orderBot } from "@/lib/core/bots";
import { UserError } from "@/lib/core/validate";
import { solscanTx } from "@/lib/config";
import { sql } from "@/lib/db";
import { coinInfo } from "@/lib/core/coin";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;
const kinds = () => Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { ...v, pkgs: v.pkgs.map(p => ({ id: p.id, name: p.name, blurb: p.blurb, price: Number(p.price) / 1e9, volume: Number(p.volume) / 1e9, trades: p.trades })) }]));
export async function GET(req: Request) { { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const u = new URL(req.url); const ctx = await apiCtx(req).catch(() => null) ?? ({} as any);
  const what = u.searchParams.get("what");
  if (what === "feed") { const f = await botFeed(40, u.searchParams.get("mint") ?? undefined); return Response.json({ feed: f.map((t: any) => ({ ...t, lamports: Number(t.lamports), url: t.sig ? solscanTx(t.sig) : null })) }); }
  const [markets, mine] = await Promise.all([botMarkets((u.searchParams.get("filter") ?? "all") as any), (ctx.walletKey ?? (ctx.agentId ? ctx.ownerKey : null)) ? myBotOrders(ctx.walletKey ?? ctx.ownerKey) : Promise.resolve([])]);
  const fm = u.searchParams.get("mint"); let focus: any = fm ? markets.find((m: any) => m.mint === fm) ?? null : null;
  if (fm && !focus) { const [l] = await sql`select mint,name,ticker,logo_cid,launched_at from launches where mint=${fm}`; if (l) { const ci: any = await coinInfo(fm).catch(() => null); const p = ci?.curve?.progress ?? 0; focus = { ...l, progress: p, complete: !!ci?.curve?.complete, status: ci?.curve?.complete ? "graduated" : p >= 50 ? "graduating" : "new" }; } }
  return Response.json({ kinds: kinds(), markets, focus, orders: mine.map((o: any) => ({ ...o, price_lamports: Number(o.price_lamports), target_volume_lamports: Number(o.target_volume_lamports), done_volume_lamports: Number(o.done_volume_lamports) })), signedIn: !!(ctx.walletKey || ctx.agentId) });
}
export async function POST(req: Request) { { const busy = await limitIp(req, "bots-w", 30, 60); if (busy) return busy; }
  const b = await req.json().catch(() => ({}));
  try { const ctx = await apiCtx(req); const r = await orderBot(ctx, { mint: b.mint, kind: b.kind, package: b.package, confirm: b.confirm === true, pay: b.pay }); return Response.json(r); }
  catch (e: any) { return Response.json({ error: e instanceof UserError ? e.message : `Something went wrong: ${String(e.message).slice(0, 200)}` }, { status: 400 }); }
}
