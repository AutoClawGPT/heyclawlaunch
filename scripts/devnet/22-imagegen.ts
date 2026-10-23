// Image gen + quick launch E2E: CLI-level logo, bot quick launch (Confirm-gated, owner-only), web API quick launch (SIWS user).
import { writeFileSync, mkdirSync } from "fs";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { generateLogo, logoPrompt } from "@/lib/image-gen";
import { botQuick, botGenLogo, tgCtx } from "@/lib/bots/telegram";
import { executePending } from "@/lib/brain/agent";
import { runTool } from "@/lib/tools/run";
import { sql } from "@/lib/db";
import { report } from "./lib";
const BASE = process.env.APP_URL ?? "http://localhost:3100"; mkdirSync("/workspace/shots", { recursive: true });
const save = (n: string, b: Uint8Array) => { const f = `/workspace/shots/gen-${n}.png`; writeFileSync(f, b); return f; };
const tryit = async (name: string, fn: () => Promise<string>) => { try { report(name, true, await fn()); } catch (e: any) { report(name, false, String(e.message ?? e).slice(0, 300)); } };

await tryit("22a-generate_logo", async () => { const t = Date.now(); const g = await generateLogo(logoPrompt("a cat astronaut on the moon")); return `${save("logo-cat", g.bytes)} ${g.bytes.length}B ${g.type} model ${g.model} ${Date.now() - t}ms ipfs ${g.url}`; });
await tryit("22b-generate_token_idea(tool)", async () => { const r = await runTool({ ownerKey: "cli:test", surface: "mcp" } as any, "generate_token_idea", { theme: "frogs on mars" }); if (r.isError) throw new Error(r.text); return r.text.replace(/\n/g, " | "); });

// Bot: two Telegram users; user B can't confirm A's quick launch; A confirms -> launched.
await tryit("22c-bot-quick-launch", async () => {
  const A = await tgCtx(7200000000 + Math.floor(Math.random() * 1e6)), B = await tgCtx(7300000000 + Math.floor(Math.random() * 1e6));
  const th: any = { messages: [], draftId: null };
  const q = await botQuick(A, th, "a sleepy space otter"); save(`quick-bot-${q.idea.ticker.toLowerCase()}`, q.bytes);
  if (!q.pending) throw new Error("draft not ready: " + q.caption);
  const [before] = await sql`select count(*)::int n from launches where draft_id=${q.draftId}`;
  const g = await botGenLogo(A, th); save(`regen-bot-${q.idea.ticker.toLowerCase()}`, g.bytes); // Regenerate keeps the same draft
  const pend2 = (await import("@/lib/brain/agent")).createPending(A, "confirm_launch", { draft_id: q.draftId });
  const p2 = await pend2; const other = await executePending(B, p2.id);
  const r = await executePending(A, p2.id); if ("error" in r) throw new Error(r.error);
  const [l] = await sql`select * from launches where draft_id=${q.draftId}`; if (!l) throw new Error(r.out.text.slice(0, 300));
  return `${q.idea.name} ($${q.idea.ticker}) launches-before-confirm=${before.n} crossUserConfirmRejected=${"error" in other} mint ${l.mint} create ${l.create_sig} split ${l.split_sig} fees→${l.recipient} logo ipfs ${l.logo_cid}`;
});

// Web API: SIWS sign-in, POST /api/gen {action:"idea", quick:true} -> pending, then /api/robot confirmActionId.
await tryit("22d-web-quick-launch", async () => {
  const kp = Keypair.generate();
  const input = await fetch(`${BASE}/api/siws/input`).then(r => r.json());
  const text = await fetch(`${BASE}/api/siws/input`, { method: "POST", body: JSON.stringify({ ...input, address: kp.publicKey.toBase58() }) }).then(r => r.text());
  const msg = new TextEncoder().encode(text);
  const v = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: kp.publicKey.toBase58(), signedMessage: Buffer.from(msg).toString("base64"), signature: Buffer.from(nacl.sign.detached(msg, kp.secretKey)).toString("base64") }) });
  const cookie = (v.headers.get("set-cookie") ?? "").split(";")[0];
  const g = await fetch(`${BASE}/api/gen`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ action: "idea", theme: "a pizza wizard", quick: true }) }).then(r => r.json());
  if (g.error || !g.pending) throw new Error(g.error ?? "no pending: " + g.reply);
  const img = new Uint8Array(await (await fetch(`${BASE}${g.ui.card.logo}`)).arrayBuffer()); save(`quick-web-${String(g.ui.card.ticker).toLowerCase()}`, img);
  const c = await fetch(`${BASE}/api/robot`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ messages: [], draftId: g.draftId, confirmActionId: g.pending.id }) }).then(r => r.json());
  if (!c.ui?.live) throw new Error("not launched: " + c.reply);
  const [l] = await sql`select * from launches where draft_id=${g.draftId}`;
  return `${g.ui.card.name} ($${g.ui.card.ticker}) mint ${l.mint} create ${l.create_sig} split ${l.split_sig} fees→${l.recipient}`;
});
process.exit(0);
