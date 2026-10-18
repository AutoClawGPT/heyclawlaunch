// pnpm seed-templates [count]  -> AI-generates launch templates (Pollinations text + image), pins logos to IPFS.
import { sql } from "@/lib/db";
import { generateTokenIdea } from "@/lib/image-gen";
const THEMES = ["frogs on mars", "sleepy otters", "cyber cats", "a dog CEO", "pizza astronauts", "robot claw arcade", "tiny dragons", "moon ducks", "penguin DJs", "laser llamas"];
const n = Number(process.argv[2] ?? 8);
for (let i = 0; i < n; i++) {
  const theme = THEMES[i % THEMES.length];
  try {
    const t = await generateTokenIdea(theme);
    const id = t.ticker.toLowerCase();
    await sql`insert into templates(id,name,ticker,description,logo_cid,pair,theme,sort) values(${id},${t.name},${t.ticker},${t.description},${t.logo.cid},'SOL',${theme},${i}) on conflict(id) do update set name=excluded.name, description=excluded.description, logo_cid=excluded.logo_cid, theme=excluded.theme`;
    console.log("template", id, t.name, t.ticker, t.logo.url);
  } catch (e: any) { console.error("fail", theme, e.message); }
}
process.exit(0);
