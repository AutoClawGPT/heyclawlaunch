import { sql } from "@/lib/db";
import { cfg } from "@/lib/config";
import { limitIp } from "@/lib/ratelimit";
import { feesFor } from "@/lib/core/claims";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
/** Claimable creator rewards for one coin — the same feesFor() value /api/scan shows (80% creator share of pump's distributable fees), plus the gross and the platform 20%. Read-only. */
export async function GET(req: Request, { params }: { params: Promise<{ mint: string }> }) {
  { const busy = await limitIp(req, "pub-r", 300, 60); if (busy) return busy; }
  const { mint } = await params;
  const [l] = await sql`select recipient from launches where mint=${mint}`.catch(() => []);
  if (!l?.recipient) return Response.json({ claimable_sol: null });
  const [f] = await feesFor(l.recipient, [mint]).catch(() => []);
  const creator = f?.claimable_sol ?? 0, share = (10_000 - cfg.platformBps) / 10_000, total = share > 0 ? creator / share : 0;
  return Response.json({ total_sol: total, creator_sol: creator, platform_sol: total - creator, creator_bps: 10_000 - cfg.platformBps, platform_bps: cfg.platformBps, claimed_sol: f?.claimed_sol ?? 0, can_claim: !!f?.can_claim }, { headers: { "cache-control": "no-store" } });
}
