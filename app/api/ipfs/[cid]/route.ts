export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/.test(cid)) return Response.json({ error: "bad cid" }, { status: 400 });
  for (const gw of [process.env.PINATA_GATEWAY ?? "ipfs.io", "gateway.pinata.cloud", "dweb.link"]) {
    try { const r = await fetch(`https://${gw}/ipfs/${cid}`, { signal: AbortSignal.timeout(8000) }); if (r.ok) return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=31536000, immutable" } }); } catch {}
  }
  return Response.json({ error: "not found" }, { status: 404 });
}
