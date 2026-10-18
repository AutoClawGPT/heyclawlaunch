// pnpm gen-token "<idea or theme>" [out.png]
import { writeFileSync } from "fs";
import { generateTokenIdea } from "@/lib/image-gen";
const [theme, out] = process.argv.slice(2);
const t = await generateTokenIdea(theme || undefined);
const file = out ?? `${t.ticker.toLowerCase()}.${t.logo.type.split("/")[1]}`;
writeFileSync(file, t.logo.bytes);
console.log(JSON.stringify({ name: t.name, ticker: t.ticker, description: t.description, image: { file, url: t.logo.url, cid: t.logo.cid, model: t.logo.model } }, null, 1));
process.exit(0);
