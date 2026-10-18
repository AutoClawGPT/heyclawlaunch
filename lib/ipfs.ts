const JWT = () => process.env.PINATA_JWT!;
export const gatewayUrl = (cid: string) => `https://${process.env.PINATA_GATEWAY ?? "ipfs.io"}/ipfs/${cid}`;
export async function pinFile(bytes: Uint8Array, name: string, type: string): Promise<string> {
  if (process.env.IPFS_MOCK === "1") return "bafkreimock" + Buffer.from(bytes).toString("hex").slice(0, 20);
  const fd = new FormData();
  fd.append("network", "public");
  fd.append("file", new Blob([bytes as BlobPart], { type }), name);
  const r = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { Authorization: `Bearer ${JWT()}` }, body: fd });
  const j: any = await r.json();
  if (!r.ok || !j?.data?.cid) throw new Error(`IPFS pin failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.data.cid as string;
}
export const pinJson = (obj: unknown, name = "metadata.json") => pinFile(new TextEncoder().encode(JSON.stringify(obj)), name, "application/json");
