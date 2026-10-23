// Agent journey over the public API: profile, directory, login cookie, dashboard controls, A2A auto-trade, claim code, scanner, X-verify rejection.
import fs from "fs";
const B = "https://heyclawlaunch.vercel.app";
const reg = JSON.parse(fs.readFileSync("/workspace/audit2/reg.json", "utf8")), peer = JSON.parse(fs.readFileSync("/workspace/audit2/peer.json", "utf8"));
const L = JSON.parse(fs.readFileSync("/workspace/audit2/launch.json", "utf8")); const MINT = L.mint, CODE = String(L.text ?? "").match(/HCL-[A-Z0-9-]+/)?.[0];
let KEY = reg.api_key;
const sh = (x: any) => JSON.stringify(x).replace(/hcla_\w+/g, "hcla_***").replace(/HCL-[A-Z0-9-]+/g, "HCL-***").replace(/"(api_key|bearer_token|secret[^"]*)":"[^"]+"/g, '"$1":"***"').slice(0, 260);
const log: any[] = []; const rep = (n: string, ok: boolean, d: any) => { log.push({ n, ok, d: sh(d) }); console.log(ok ? "PASS" : "FAIL", n, sh(d)); };
const F = async (path: string, o: any = {}, key: string | null = KEY) => { const r = await fetch(B + path, { ...o, headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...(o.headers ?? {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t.slice(0, 200); } return { s: r.status, j, h: r.headers }; };
rep("register-fields", ["api_key", "bearer_token", "mcp_url", "wallet_address", "wallet_secret_key", "profile_url"].every(k => reg[k]) && reg.bearer_token === "Bearer " + reg.api_key && !!reg.verify?.code, Object.keys(reg));
rep("launch-claim-code", !!CODE, { mint: MINT, code: !!CODE });
let r = await F("/api/agents/me"); rep("me", r.s === 200 && r.j.agent?.handle === "audit2_bot", { s: r.s, bal: r.j.balance_sol, stats: r.j.stats });
r = await F("/api/agents/me", { method: "PATCH", body: { bio: "audit bio edited", avatar_url: "https://picsum.photos/seed/a3/256" } }); rep("edit-profile", r.s === 200 && r.j.agent?.bio === "audit bio edited", r.j);
r = await F("/api/agents/me", { method: "PATCH", body: { bio: "x" } }, null); rep("edit-profile-anon-401", r.s === 401, r.s);
r = await F("/api/agents/audit2_bot", {}, null); rep("public-profile-api", r.s === 200 && JSON.stringify(r.j).includes("audit bio edited") && !/secret|api_key|key_hash/.test(JSON.stringify(r.j)), Object.keys(r.j));
for (const s of ["new", "volume", "followers"]) { r = await F(`/api/agents?sort=${s}`, {}, null); rep(`agents-list-${s}`, r.s === 200 && r.j.agents?.some((a: any) => a.handle === "audit2_bot"), r.j.agents?.length); }
r = await F("/agents/audit2_bot", {}, null); rep("profile-page", r.s === 200 && String(r.j).length > 0, r.s);
// login with API key -> cookie
const lg = await fetch(B + "/api/agents/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: KEY }) }); const ck = lg.headers.get("set-cookie") ?? "";
rep("login-cookie", lg.status === 200 && /HttpOnly/i.test(ck) && /Secure/i.test(ck), { s: lg.status, flags: ck.split(";").slice(1).map(x => x.trim()).join(";") });
const cookie = ck.split(";")[0];
r = await F("/api/agents/me", { headers: { cookie } }, null); rep("cookie-auth", r.s === 200, r.s);
r = await F("/api/agents/login", { method: "POST", body: { api_key: "hcla_wrong" } }, null); rep("login-wrong-key-401", r.s === 401, r.s);
// LLM key
r = await F("/api/llm-key", { method: "POST", body: { provider: "openai", api_key: "sk-test-invalid-000000000000000000000000" } }); rep("llm-key-set", r.s === 200 || r.s === 400, { s: r.s, j: r.j });
r = await F("/api/llm-key"); rep("llm-key-not-returned", r.s === 200 && !JSON.stringify(r.j).includes("sk-test-invalid"), r.j);
r = await F("/api/llm-key", { method: "POST", body: { clear: true } }); rep("llm-key-clear", r.s === 200, r.j);
// X verify rejection
r = await F("/api/agents/verify", { method: "POST", body: { post_url: "https://x.com/jack/status/20" } }); rep("x-verify-reject", r.j?.status === "failed" || r.s >= 400, r.j);
r = await F("/api/agents/verify", { method: "POST", body: { post_url: "not a url" } }); rep("x-verify-bad-url", r.s >= 400, r.j);
// A2A: peer subscribes to me with autotrade; I broadcast; peer auto-buys
r = await F("/api/a2a/subscribe", { method: "POST", body: { agent: "audit2_bot", autotrade: true, max_sol_per_trade: 0.01, daily_sol: 0.02 } }, peer.api_key); rep("a2a-subscribe-autotrade", r.j?.autotrade === true, r.j);
r = await F("/api/a2a/call", { method: "POST", body: { side: "buy", mint: MINT, amount_sol: 0.005, note: "audit call" } }); rep("a2a-call", r.s === 200, r.j);
await new Promise(x => setTimeout(x, 8000));
r = await F("/api/a2a/inbox", {}, peer.api_key); rep("a2a-inbox-peer", r.s === 200 && JSON.stringify(r.j).includes(MINT), r.j);
// community like/follow
const feed = await F("/api/community", {}, null); const pid = feed.j?.posts?.find((p: any) => p.author?.handle === "audit2_bot")?.id;
r = await F("/api/community/like", { method: "POST", body: { post_id: pid } }, peer.api_key); rep("like", r.s === 200, r.j);
r = await F("/api/community/follow", { method: "POST", body: { target: "audit2_bot" } }, peer.api_key); rep("follow", r.s === 200, r.j);
r = await F("/api/community", { method: "POST", body: { body: "anon" } }, null); rep("post-anon-rejected", r.s >= 400, r.s);
// scanner + claim
r = await F(`/api/scan?wallet=${reg.wallet_address}`, {}, null); rep("scanner", r.s === 200 && JSON.stringify(r.j).includes(MINT), r.j);
r = await F("/api/claim/code", { method: "POST", body: { wallet: reg.wallet_address, code: CODE } }, null); rep("claim-code-check", r.s === 200, r.j);
r = await F("/api/claim/code", { method: "POST", body: { wallet: reg.wallet_address, code: "HCL-AAAAAA-BBBBBB-CCC" } }, null); rep("claim-code-wrong", r.s >= 400, r.j);
r = await F("/api/claim/code", { method: "POST", body: { wallet: reg.wallet_address, code: CODE, confirm: true } }, null); rep("claim-code-confirm", r.s === 200 || /minimum|nothing/i.test(JSON.stringify(r.j)), r.j);
r = await F("/api/v1/tools/claim_fees", { method: "POST", body: {} }); rep("claim-fees-tool", r.s === 200, r.j);
// rotate key: old key must stop working
r = await F("/api/agents/me", { method: "POST", body: { action: "rotate_key" } }); const nk = r.j?.api_key;
rep("rotate-key", r.s === 200 && !!nk && nk !== KEY, { s: r.s });
if (nk) { const old = await F("/api/agents/me"); rep("old-key-dead", old.s === 401, old.s); KEY = nk; reg.api_key = nk; reg.bearer_token = "Bearer " + nk; fs.writeFileSync("/workspace/audit2/reg.json", JSON.stringify(reg)); const nw = await F("/api/agents/me"); rep("new-key-works", nw.s === 200, nw.s); }
fs.writeFileSync("/workspace/audit2/agent-log.json", JSON.stringify(log, null, 1)); process.exit(0);
