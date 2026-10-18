// Ready-made launch templates: AI-generated name/ticker/description/logo, launched in one tap (still needs the user's confirm).
import { sql } from "@/lib/db";
import { prepareLaunch } from "@/lib/core/drafts";
import { getOrCreateCustodial } from "@/lib/keystore";
import { gatewayUrl } from "@/lib/ipfs";
import { UserError } from "@/lib/core/validate";
import type { Ctx } from "@/lib/core/ctx";

export type Template = { id: string; name: string; ticker: string; description: string | null; logo_cid: string | null; pair: string; theme: string | null; logo_url?: string; logo_src?: string };
export async function listTemplates(): Promise<Template[]> {
  const rows = await sql`select * from templates order by sort, created_at`;
  return rows.map((t: any) => ({ ...t, logo_url: t.logo_cid ? gatewayUrl(t.logo_cid) : undefined, logo_src: t.logo_cid ? `/api/ipfs/${t.logo_cid}` : undefined }));
}
export async function getTemplate(id: string) { const [t] = await sql`select * from templates where id=${id}`; if (!t) throw new UserError("Unknown template."); return { ...t, logo_url: t.logo_cid ? gatewayUrl(t.logo_cid) : undefined, logo_src: t.logo_cid ? `/api/ipfs/${t.logo_cid}` : undefined } as Template; }
/** Creates a complete draft from the template. Fees go to the user's own custodial wallet (80%). Returns the draft; launching still needs confirm_launch. */
export async function draftFromTemplate(ctx: Ctx, id: string) {
  const key = ctx.walletKey ?? (ctx.ownerKey.startsWith("tg:") ? ctx.ownerKey : null);
  if (!key) throw new UserError("Sign in first: templates launch from your own wallet, and the 80% creator fees go to it.");
  const t = await getTemplate(id);
  const wallet = await getOrCreateCustodial(key);
  const r = await prepareLaunch(ctx, { start_new: true, name: t.name, ticker: t.ticker, description: t.description ?? "", logo_image: t.logo_url, fee_mode: "wallet", fee_wallet: wallet, pair: t.pair || "SOL", skip_socials: true });
  if (r.error) throw new UserError(r.text);
  return { draft: r.draft, ready: r.ready, text: r.text, wallet, template: t };
}
