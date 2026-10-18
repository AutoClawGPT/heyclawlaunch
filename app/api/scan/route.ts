import { api, options } from "@/lib/http"; import { scanWallet } from "@/lib/core/claims"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async req => { const w = new URL(req.url).searchParams.get("wallet"); if (!w) throw new UserError("?wallet= is required."); return scanWallet(w.trim()); });
