import { api, options, body } from "@/lib/http"; import { checkClaimCode, feesFor, claimTo } from "@/lib/core/claims"; import { sql } from "@/lib/db"; import { UserError } from "@/lib/core/validate";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options; export const maxDuration = 60;
export const POST = api(async req => { const b = await body(req); const wallet = String(b.wallet ?? "").trim();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const [r] = await sql`select count(*)::int n from audit_log where action='claim_code_fail' and actor=${"ip:" + ip} and ts > now() - interval '15 minutes'`; if (r.n >= 10) throw new UserError("Too many wrong codes. Wait 15 minutes.", 429);
  let c; try { c = await checkClaimCode(wallet, b.code); } catch (e) { await sql`insert into audit_log(actor,action) values(${"ip:" + ip},'claim_code_fail')`; throw e; }
  if (b.confirm === true) return { wallet, claimed: await claimTo(wallet, [c.mint], "code"), fees: await feesFor(wallet, [c.mint]) };
  return { wallet, fees: await feesFor(wallet, [c.mint]) }; });
