// Pins binary site art + README screenshots to IPFS (the repo only carries text). Writes lib/assets.json.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { pinFile } from "@/lib/ipfs";
const out: Record<string, string> = existsSync("lib/assets.json") ? JSON.parse(readFileSync("lib/assets.json", "utf8")) : {};
const files = [...readdirSync("public/art").map(f => `public/art/${f}`), ...["home-1280", "launch-1280", "token-1280", "explore-1280", "home-390", "mascot-1280"].map(n => `/workspace/shots/hcl-${n}.png`)];
for (const f of files) { if (!existsSync(f)) continue; const name = f.split("/").pop()!; const cid = await pinFile(new Uint8Array(readFileSync(f)), name, name.endsWith(".png") ? "image/png" : "image/jpeg"); out[name] = cid; console.log(name, cid); }
writeFileSync("lib/assets.json", JSON.stringify(out, null, 2) + "\n"); process.exit(0);
