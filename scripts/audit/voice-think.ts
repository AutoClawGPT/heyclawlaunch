// Live check of the voice agent's think config (Gemini 3.1 Flash Lite + fallback, do_arithmetic, end_conversation) against Deepgram.
import WebSocket from "ws";
import { readFileSync } from "fs";
const src = readFileSync("components/hcl/useVoiceAgent.ts", "utf8");
const mod: any = await import("../../components/hcl/useVoiceAgent");
const PROMPT = "You are Claw. Use do_arithmetic for any math. When the user says goodbye, call end_conversation.";
const FUNCS = JSON.parse(JSON.stringify(eval("(" + src.slice(src.indexOf("const FUNCS = ") + 14, src.indexOf("];", src.indexOf("const FUNCS = ")) + 1) + ")")));
const mk = (first: any) => [{ provider: first, prompt: PROMPT, functions: FUNCS }, { provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.4 }, prompt: PROMPT, functions: FUNCS }];
async function run(label: string, think: any, says: string[]) {
  const ws = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", ["token", process.env.DEEPGRAM_API_KEY!]);
  const ev: string[] = []; let i = 0;
  await new Promise<void>(res => {
    const t = setTimeout(() => { ws.close(); res(); }, 40000);
    ws.on("open", () => ws.send(JSON.stringify({ type: "Settings", audio: { input: { encoding: "linear16", sample_rate: 16000 }, output: { encoding: "linear16", sample_rate: 24000, container: "none" } }, agent: { listen: { provider: { type: "deepgram", model: "flux-general-en", version: "v2" } }, think, speak: { provider: { type: "deepgram", version: "v2", model: "flux-cole-en" } } } })));
    ws.on("message", (d: any, bin: boolean) => { if (bin) return; const m = JSON.parse(String(d)); if (!/History|AgentAudioDone|AgentStartedSpeaking/.test(m.type)) ev.push(m.type + (m.functions ? ":" + m.functions.map((f: any) => f.name + f.arguments).join(",") : m.content ? ":" + String(m.content).slice(0, 80) : m.description ? ":" + m.description : m.code ? ":" + m.code : ""));
      if (m.type === "SettingsApplied" || (m.type === "ConversationText" && m.role === "assistant")) { if (i < says.length) ws.send(JSON.stringify({ type: "InjectUserMessage", content: says[i++] })); else if (m.type === "ConversationText") { clearTimeout(t); setTimeout(() => { ws.close(); res(); }, 1500); } }
      if (m.type === "FunctionCallRequest") for (const f of m.functions) { const a = JSON.parse(f.arguments || "{}"); ws.send(JSON.stringify({ type: "FunctionCallResponse", id: f.id, name: f.name, content: f.name === "do_arithmetic" ? mod.doArithmetic(a.expression) : "ok, ending the call" })); }
      if (m.type === "Error") { clearTimeout(t); ws.close(); res(); } });
  });
  console.log(label, "\n  " + ev.join("\n  "));
}
await run("PRIMARY gemini-3.1-flash-lite", mk({ type: "google", model: "gemini-3.1-flash-lite", temperature: 0.4 }), ["What is 0.2 times 0.8 plus 17.5?", "thanks, goodbye"]);
await run("FALLBACK (bad primary model)", mk({ type: "google", model: "gemini-does-not-exist", temperature: 0.4 }), ["What is 12 divided by 5?"]);
console.log("unit", mod.doArithmetic("0.2*0.8+17.5"), mod.doArithmetic("(3+2)/4"), mod.doArithmetic("alert(1)"));
process.exit(0);
