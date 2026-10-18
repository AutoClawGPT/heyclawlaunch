// pnpm gen-art  -> public/art/*.jpg (site backgrounds and section art)
import { writeFileSync } from "fs";
import { generateArt } from "@/lib/image-gen";
const style = "dark ink navy-black background #07080d, electric cyan #3cf0e0 and hot coral #ff4f7b neon accents, cinematic lighting, high detail, no text, no letters, no watermark";
const ART: [string, string, string][] = [
  ["hero-bg", "1536x1024", `Wide atmospheric night-market city of glowing trading candles and holographic coins, a giant friendly robot claw arcade machine in the distance, depth haze, ${style}`],
  ["section-launch", "1024x1024", `A cute glossy white robot with pink claw hands launching a glowing coin like a rocket from its claw, sparks, ${style}`],
  ["section-templates", "1024x1024", `Grid of floating holographic memecoin cards with cute mascots (frog, cat, dog, otter), isometric, ${style}`],
  ["section-bots", "1024x1024", `Swarm of small robot drones pumping a neon green trading chart upward, ${style}`],
  ["section-leaderboard", "1024x1024", `Podium with three glowing trophies made of Solana-coloured crystal coins, confetti, ${style}`],
  ["section-voice", "1024x1024", `A robot head with a glowing sound-wave visor talking into a retro microphone, ${style}`],
];
const only = process.argv[2];
for (const [name, size, prompt] of ART) {
  if (only && name !== only) continue;
  const r: any = await generateArt(prompt, size);
  const ext = r.type === "image/png" ? "png" : r.type === "image/webp" ? "webp" : "jpg";
  writeFileSync(`public/art/${name}.${ext}`, r.bytes);
  console.log(`${name}.${ext}`, r.model, r.fallbackFrom ? `(fallback from ${r.fallbackFrom})` : "");
}
process.exit(0);
