import { api, options, body } from "@/lib/http"; import { apiCtx } from "@/lib/core/agents"; import { feed, createPost, resolveTarget } from "@/lib/core/social";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const OPTIONS = options;
export const GET = api(async req => { const q = new URL(req.url).searchParams; const ctx = await apiCtx(req).catch(() => null); const viewer = ctx?.agentId ? "agent:" + ctx.agentId : ctx?.walletKey;
  const author = q.get("author") ? await resolveTarget(q.get("author")!) : undefined;
  return { viewer: viewer ?? null, posts: await feed({ viewer, author, postId: q.get("post") ? Number(q.get("post")) : undefined, following: q.get("tab") === "following", calls: q.get("tab") === "calls", before: q.get("before") ? Number(q.get("before")) : undefined }) }; });
export const POST = api(async req => createPost(await apiCtx(req), await body(req)));
