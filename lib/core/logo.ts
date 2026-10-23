import { lookup } from "dns/promises";
import { isIP } from "net";
import { pinFile } from "@/lib/ipfs";
import { UserError } from "./validate";
const MAX = 5 * 1024 * 1024;
export function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}
const privateIp = (ip: string) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
async function safeFetch(url: string, hops = 0): Promise<Uint8Array> {
  let u: URL;
  try { u = new URL(url); } catch { throw new UserError("That logo link is not a valid URL."); }
  if (u.protocol !== "https:") throw new UserError("The logo link must be https:// or ipfs://.");
  const host = u.hostname;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => { throw new UserError("Couldn't reach the logo link's host. Try another link or the upload page."); })).map(a => a.address);
  if (ips.some(privateIp)) throw new UserError("That logo link points to a private address.");
  // Follow redirects by hand (max 3) so every hop gets the same private-address check.
  let r: Response;
  try { r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15000) }); }
  catch { throw new UserError("Couldn't download the logo (network error or timeout). Try another link or the upload page."); }
  if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
    if (hops >= 3) throw new UserError("The logo link redirects too many times.");
    return safeFetch(new URL(r.headers.get("location")!, u).toString(), hops + 1);
  }
  if (!r.ok) throw new UserError(`Couldn't download the logo (HTTP ${r.status}). Try another link or the upload page.`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > MAX) throw new UserError("The logo must be 5 MB or less.");
  return buf;
}
export async function pinLogoBytes(buf: Uint8Array): Promise<string> {
  if (buf.length > MAX) throw new UserError("The logo must be 5 MB or less.");
  const type = sniff(buf);
  if (!type) throw new UserError("The logo must be a PNG, JPEG, GIF or WEBP image.");
  return pinFile(buf, "logo." + type.split("/")[1], type);
}
export async function resolveLogo(input: string): Promise<string> {
  input = input.trim();
  const ipfs = input.match(/^ipfs:\/\/(?:ipfs\/)?([A-Za-z0-9]+)/) ?? input.match(/^https:\/\/[^/]+\/ipfs\/([A-Za-z0-9]{46,})/);
  if (ipfs) return ipfs[1];
  const data = input.match(/^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i);
  if (data) return pinLogoBytes(Buffer.from(data[3], "base64"));
  return pinLogoBytes(await safeFetch(input));
}
