// pnpm gen-image "<prompt>" out.png [--model m] [--size 1024x1024] [--raw] [--no-pin]
import { writeFileSync } from "fs";
import { imageProvider, logoPrompt, DEFAULT_IMAGE_MODEL } from "@/lib/image-gen";
import { pinLogoBytes } from "@/lib/core/logo";
import { gatewayUrl } from "@/lib/ipfs";
const a = process.argv.slice(2); const flag = (n: string) => { const i = a.indexOf(n); return i >= 0 ? a.splice(i, 2)[1] : undefined; }; const has = (n: string) => { const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); return i >= 0; };
const model = flag("--model") ?? DEFAULT_IMAGE_MODEL(), size = flag("--size") ?? "1024x1024", raw = has("--raw"), noPin = has("--no-pin");
const [prompt, out = "out.png"] = a;
if (!prompt) { console.error('usage: pnpm gen-image "<prompt>" out.png [--model m] [--size 1024x1024] [--raw] [--no-pin]'); process.exit(2); }
const t = Date.now();
const img = await imageProvider().generate(raw ? prompt : logoPrompt(prompt), { model, size });
writeFileSync(out, img.bytes);
const cid = noPin ? null : await pinLogoBytes(img.bytes);
console.log(JSON.stringify({ file: out, bytes: img.bytes.length, type: img.type, model: img.model, provider: img.provider, ms: Date.now() - t, cid, url: cid ? gatewayUrl(cid) : null }, null, 1));
process.exit(0);
