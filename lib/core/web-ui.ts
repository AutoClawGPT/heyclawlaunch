import { sql } from "@/lib/db";
import { feeLabel } from "@/lib/core/drafts";
/** Coin-card state for the web chat. */
export async function webUi(ctx: any, draftId: string | null) {
  if (!draftId) return {};
  const [d] = await sql`select * from drafts where id=${draftId} and owner_key=${ctx.ownerKey}`;
  if (!d) return {};
  const [l] = await sql`select mint from launches where draft_id=${d.id}`;
  return { card: { name: d.name, ticker: d.ticker, logo: d.logo_cid ? `/api/ipfs/${d.logo_cid}` : null, fees: d.fee_mode ? feeLabel(d) : null, pair: d.pair_symbol }, ready: d.status === "ready",
    live: l ? { mint: l.mint, pageUrl: `/token/${l.mint}`, pumpUrl: `https://pump.fun/coin/${l.mint}` } : undefined };
}
