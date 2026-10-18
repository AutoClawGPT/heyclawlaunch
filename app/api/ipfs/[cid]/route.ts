// IPFS image proxy: races several public gateways (first good response wins) and caches forever on the CDN.
export const runtime = "nodejs"; export const maxDuration = 30;
const GWS = () => [...new Set([process.env.PINATA_GATEWAY, "gateway.pinata.cloud", "ipfs.io", "dweb.link", "cloudflare-ipfs.com", "w3s.link"].filter(Boolean) as string[])];
async function get(gw: string, cid: string, signal: AbortSignal) {
  const r = await fetch(`https://${gw}/ipfs/${cid}`, { signal }); if (!r.ok) throw new Error(String(r.status));
  const ct = r.headers.get("content-type") ?? ""; if (ct.includes("text/html")) throw new Error("html");
  return { body: new Uint8Array(await r.arrayBuffer()), ct: ct || "image/png" };
}
export async function GET(_: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/.test(cid)) return Response.json({ error: "bad cid" }, { status: 400 });
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await Promise.any(GWS().map(g => get(g, cid, ac.signal)));
    return new Response(r.body as BodyInit, { headers: { "content-type": r.ct, "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  } catch { return Response.json({ error: "not found" }, { status: 404, headers: { "cache-control": "no-store" } }); }
  finally { clearTimeout(t); ac.abort(); }
}
