// Full spec flow with the official MCP SDK client against the running dev server, on devnet.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import nacl from "tweetnacl";
import BN from "bn.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { report } from "./lib";
import { conn, launchWallet, sendV0, online } from "@/lib/solana";
import { PUMP_SDK, getBuyV3TokenAmountFromQuoteAmount } from "@/lib/solana/pump";
const BASE = process.env.APP_URL!;
const text = (r: any) => r.content?.[0]?.text as string;
const must = (c: boolean, m: string) => { if (!c) throw new Error(m); };

// --- 1. anonymous /mcp ---
const anon = new Client({ name: "e2e-anon", version: "1.0.0" });
const t1 = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`));
await anon.connect(t1);
const sv = anon.getServerVersion(); const caps = anon.getServerCapabilities();
const instr = anon.getInstructions() ?? "";
const pvRes = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "x", version: "1" } } }) }).then(r => r.text());
const negotiated = pvRes.match(/"protocolVersion":"([^"]+)"/)?.[1];
const tools = (await anon.listTools()).tools;
report("11a-mcp-init", negotiated === "2025-06-18" && ["prepare_launch","list_pairs","get_logo_upload_link","confirm_launch","launch_status","my_launches","my_wallet","claim_fees","withdraw","swap","list_templates","use_template","leaderboard","volume_bot"].every(n => tools.some((t: any) => t.name === n)) && tools.length === 16 && instr.includes("prepare_launch RIGHT AWAY") && !!caps?.tools?.listChanged, `server ${sv?.name}/${sv?.version}, negotiated ${negotiated} (client asked 2025-11-25), session ${t1.sessionId ? "yes" : "no"}, tools=${tools.length}`);
const w0 = await anon.callTool({ name: "my_wallet", arguments: {} });
report("11b-wallet-tool-anon", !!w0.isError && text(w0).includes("/mcp/wallet"), text(w0).slice(0, 120));
const g405 = await fetch(`${BASE}/mcp`, { headers: { accept: "text/event-stream" } });
report("11c-get-without-session", g405.status === 400, `GET /mcp without session → ${g405.status}`);
await anon.close();

// --- 2. OAuth 2.1: PRM → AS metadata → DCR → SIWS login → authorize → token (PKCE) ---
const w401 = await fetch(`${BASE}/mcp/wallet`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
const prmUrl = w401.headers.get("www-authenticate")?.match(/resource_metadata="([^"]+)"/)?.[1];
const prm = await fetch(prmUrl!).then(r => r.json());
const asm = await fetch(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`).then(r => r.json());
const reg = await fetch(asm.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "e2e", redirect_uris: ["http://127.0.0.1:8976/cb"], token_endpoint_auth_method: "none" }) }).then(r => r.json());
const user = Keypair.generate();
const input = await fetch(`${BASE}/api/siws/input`).then(r => r.json());
const msgText = await fetch(`${BASE}/api/siws/input`, { method: "POST", body: JSON.stringify({ ...input, address: user.publicKey.toBase58() }) }).then(r => r.text());
const msg = new TextEncoder().encode(msgText);
const sig = nacl.sign.detached(msg, user.secretKey);
const ver = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: user.publicKey.toBase58(), signedMessage: Buffer.from(msg).toString("base64"), signature: Buffer.from(sig).toString("base64") }) });
const cookie = ver.headers.get("set-cookie")!.split(";")[0];
const replay = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: user.publicKey.toBase58(), signedMessage: Buffer.from(msg).toString("base64"), signature: Buffer.from(sig).toString("base64") }) });
const bad = new Uint8Array(sig); bad[0] ^= 1;
const tamper = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: user.publicKey.toBase58(), signedMessage: Buffer.from(msg).toString("base64"), signature: Buffer.from(bad).toString("base64") }) });
const input2 = await fetch(`${BASE}/api/siws/input`).then(r => r.json());
const wrongDomain = new TextEncoder().encode(msgText.replace(input.domain, "evil.example").replace(input.nonce, input2.nonce));
const wd = await fetch(`${BASE}/api/siws/verify`, { method: "POST", body: JSON.stringify({ address: user.publicKey.toBase58(), signedMessage: Buffer.from(wrongDomain).toString("base64"), signature: Buffer.from(nacl.sign.detached(wrongDomain, user.secretKey)).toString("base64") }) });
report("17-siws", ver.status === 200 && replay.status === 401 && tamper.status === 401 && wd.status === 401, `valid ${ver.status}, replayed nonce ${replay.status}, tampered sig ${tamper.status}, wrong domain ${wd.status}`);
const verifier = randomBytes(32).toString("base64url"), challenge = createHash("sha256").update(verifier).digest("base64url");
const az = new URL(asm.authorization_endpoint);
az.search = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: "http://127.0.0.1:8976/cb", code_challenge: challenge, code_challenge_method: "S256", state: "st1", scope: "launch wallet", resource: prm.resource }).toString();
const page = await fetch(az, { headers: { cookie } }).then(r => r.text());
const pending = page.match(/name="pending" value="([0-9a-f]+)"/)?.[1]; must(!!pending, "no consent form");
const ap = await fetch(`${BASE}/oauth/authorize/approve`, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ pending: pending!, decision: "allow" }), redirect: "manual" });
const loc = new URL(ap.headers.get("location")!); const code = loc.searchParams.get("code")!;
const badPkce = await fetch(asm.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: "wrong", client_id: reg.client_id, redirect_uri: "http://127.0.0.1:8976/cb" }) });
// code is single-use: the failed attempt consumed it → redo authorize
const page2 = await fetch(az, { headers: { cookie } }).then(r => r.text());
const ap2 = await fetch(`${BASE}/oauth/authorize/approve`, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ pending: page2.match(/name="pending" value="([0-9a-f]+)"/)![1], decision: "allow" }), redirect: "manual" });
const code2 = new URL(ap2.headers.get("location")!).searchParams.get("code")!;
const tok = await fetch(asm.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code: code2, code_verifier: verifier, client_id: reg.client_id, redirect_uri: "http://127.0.0.1:8976/cb", resource: prm.resource }) }).then(r => r.json());
const ref = await fetch(asm.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }) }).then(r => r.json());
const reuse = await fetch(asm.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }) });
report("12-oauth", w401.status === 401 && !!reg.client_id && loc.searchParams.get("state") === "st1" && badPkce.status === 400 && !!tok.access_token && !!ref.access_token && reuse.status === 400, `401+PRM ${prmUrl}; DCR ${reg.client_id}; consent→code (state ok); wrong PKCE ${badPkce.status}; token ok (expires_in ${tok.expires_in}, scope "${tok.scope}"); refresh rotated; old refresh reuse ${reuse.status}`);

// --- 3. /mcp/wallet with bearer ---
const wc = new Client({ name: "e2e-wallet", version: "1.0.0" });
await wc.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/wallet`), { requestInit: { headers: { Authorization: `Bearer ${ref.access_token}` } } }));
const mw = text(await wc.callTool({ name: "my_wallet", arguments: {} }));
const custodial = mw.match(/wallet: ([1-9A-HJ-NP-Za-km-z]{32,44})/)![1];
report("12b-my_wallet", !!custodial, `custodial ${custodial} for SIWS user ${user.publicKey.toBase58()}`);

// --- 4. full launch through MCP (fees to the custodial wallet) ---
const call = async (name: string, args: any) => { const r: any = await wc.callTool({ name, arguments: args }); return { t: text(r), e: !!r.isError, s: r.structuredContent }; };
let r = await call("prepare_launch", { start_new: true }); const draft = r.s.draft_id;
const order: string[] = [r.t.match(/NEXT QUESTION: ([^\n]+)/)![1]];
for (const a of [{ name: "MCP E2E Cat" }, { ticker: "mcpcat" }, { logo_url: "ipfs://bafkreidlp6sdj6jkroakvmbntpy2clsj77foijheae5byt3iwz7d2k542a" }, { fee_mode: "wallet", fee_wallet: custodial }, { pair: "SOL" }, { description: "nothing" }, { skip_socials: true }]) {
  r = await call("prepare_launch", { draft_id: draft, ...a }); order.push((r.t.match(/NEXT QUESTION: ([^\n]+)/)?.[1] ?? (r.t.includes("READY") ? "READY" : r.t)).slice(0, 40));
}
const badT = await call("prepare_launch", { draft_id: draft, ticker: "bad ticker!" });
report("11d-question-order", r.t.includes("READY") && badT.e, order.join(" → ") + ` | invalid ticker → isError=${badT.e}`);
const noConf = await wc.callTool({ name: "confirm_launch", arguments: { draft_id: draft, user_confirmed: false } }).catch((e: any) => ({ isError: true, content: [{ text: String(e.message) }] }));
const live = await call("confirm_launch", { draft_id: draft, user_confirmed: true });
const mint = live.s?.mint;
report("11e-confirm_launch", !!mint && live.t.includes("is live!"), `${live.t.replace(/\n/g, " | ")} || user_confirmed:false → rejected=${!!(noConf as any).isError}`);
const st = await call("launch_status", { draft_id: draft });
report("11f-launch_status", st.t.includes("fee split: done"), st.t.split("\n").slice(-5).join(" | "));
const ml = await call("my_launches", {});
report("11g-my_launches", ml.t.includes("launches left today"), ml.t.split("\n").slice(-2).join(" | "));

// --- 5. trade to accrue creator fees, then claim through MCP ---
const launch = launchWallet(); const trader = Keypair.generate();
await sendV0([SystemProgram.transfer({ fromPubkey: launch.publicKey, toPubkey: trader.publicKey, lamports: 0.4 * LAMPORTS_PER_SOL })], [launch]);
const sdk = online(); const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig()]);
const bs = await sdk.fetchBuyState(new PublicKey(mint), trader.publicKey, TOKEN_2022_PROGRAM_ID);
const q = new BN(0.3 * LAMPORTS_PER_SOL);
const amt = getBuyV3TokenAmountFromQuoteAmount({ global, feeConfig, mintSupply: global.tokenTotalSupply, bondingCurve: bs.bondingCurve, amount: q, curveBaseTokenBalance: bs.curveBaseTokenBalance });
await sendV0(await PUMP_SDK.buyExactQuoteInV3Instructions({ bondingCurve: bs.bondingCurve, associatedUserAccountInfo: bs.associatedUserAccountInfo, mint: new PublicKey(mint), user: trader.publicKey, amount: amt, quoteAmount: q, slippage: 5, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: bs.quoteTokenProgram }), [trader]);
const mw2 = await call("my_wallet", {});
const cl = await call("claim_fees", {});
report("08b-claim_fees(mcp)", cl.t.includes("Claimed") && /\+0\.\d+ SOL/.test(cl.t), `${mw2.t.match(/Creator fees waiting: [^\n]+/)?.[0]} → ${cl.t.replace(/\n/g, " | ")}`);

// --- 6. withdraw preview/confirm (custodial signs, launch wallet pays gas) ---
await sendV0([SystemProgram.transfer({ fromPubkey: launch.publicKey, toPubkey: new PublicKey(custodial), lamports: 0.1 * LAMPORTS_PER_SOL })], [launch]);
const dest = Keypair.generate().publicKey.toBase58();
const skip = await call("withdraw", { to: dest, amount: "0.01", confirm: true });
const pv = await call("withdraw", { to: dest, amount: "0.01" });
const balBefore = await conn().getBalance(new PublicKey(dest));
const wd2 = await call("withdraw", { to: dest, amount: "0.01", confirm: true });
const wsig = wd2.t.match(/signature (\w+)/)?.[1];
const wtx = wsig ? await conn().getTransaction(wsig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }) : null;
const signers = wtx?.transaction.message.header.numRequiredSignatures;
const feePayer = wtx?.transaction.message.staticAccountKeys[0].toBase58();
const got = (await conn().getBalance(new PublicKey(dest))) - balBefore;
report("09-withdraw", skip.e && pv.t.startsWith("PREVIEW") && got === 10_000_000 && signers === 2 && feePayer === launch.publicKey.toBase58(), `confirm without preview → refused; ${pv.t.split("\n")[0]}; sent ${got} lamports, signers=${signers}, fee payer=launch wallet; https://solscan.io/tx/${wsig}?cluster=devnet`);

// --- 7. swap on devnet (pump curve; Jupiter is mainnet-only) ---
const sp = await call("swap", { from: "SOL", to: mint, amount: "0.02" });
const sc = await call("swap", { from: "SOL", to: mint, amount: "0.02", confirm: true });
const ss = await call("swap", { from: mint, to: "SOL", amount: "all" });
const sc2 = await call("swap", { from: mint, to: "SOL", amount: "all", confirm: true });
report("10-swap", sp.t.startsWith("PREVIEW") && sc.t.startsWith("Swapped") && sc2.t.startsWith("Swapped"), `buy: ${sc.t.split("\n")[0]} ${sc.t.match(/https:\S+/)?.[0]} | sell all: ${sc2.t.split("\n")[0]} ${sc2.t.match(/https:\S+/)?.[0]}`);
await wc.close();
console.log("MINT", mint);
process.exit(0);
