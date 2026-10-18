import { api, options, body } from "@/lib/http"; import { verifyBotPayment } from "@/lib/core/bots"; import { conn } from "@/lib/solana"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options; export const maxDuration = 60;
// GET ?order=<id> → auto-detects the payment by its reference; GET ?blockhash=1 → recent blockhash for the in-browser wallet button
export const GET = api(async req => { const q = new URL(req.url).searchParams;
  if (q.get("blockhash")) return { blockhash: (await conn().getLatestBlockhash("confirmed")).blockhash };
  const id = q.get("order"); if (!id) throw new UserError("?order= is required."); return verifyBotPayment(id); });
export const POST = api(async req => { const b = await body(req); if (!b.order_id) throw new UserError("order_id is required."); return verifyBotPayment(String(b.order_id), b.tx ? String(b.tx) : undefined); });
