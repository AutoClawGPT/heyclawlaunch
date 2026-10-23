"use client";
// Deepgram Voice Agent in the browser (user spec, Oct 18): audio in linear16@48000, out linear16@24000 container none; listens with Flux (flux-general-en v2), speaks with Flux TTS (flux-cole-en v2).
// Every request is routed through one client-side function, `heyclaw`, which calls OUR brain (/api/robot) with all
// launch / wallet / bot tools and the same confirm-before-acting rules. The spoken reply is whatever our brain says.
import { useRef, useState } from "react";
export type VoiceState = "off" | "connecting" | "listening" | "thinking" | "talking" | "error";
const PROMPT = `You are Claw, the voice of HeyClawLaunch, a pump.fun coin launcher on Solana devnet.
For ANY request about coins, launching, logos, templates, wallets, balances, fees, claiming, withdrawing, swapping, volume bots, the leaderboard or airdrops, call the heyclaw function with the user's request in their own words, then read its reply back naturally and briefly (skip long addresses and URLs: say "the link on screen").
Never invent results. Never say something launched or moved unless heyclaw said so. When heyclaw asks for a confirmation, ask the user out loud; if they clearly say yes, call heyclaw with "yes, confirm".
For small talk answer yourself in one or two short sentences.`;
// Think: Gemini 3.1 Flash Lite (Deepgram-managed) first; Deepgram falls back to gpt-4o-mini per turn if Google errors or times out.
const FUNCS = [
  { name: "heyclaw", description: "Ask the HeyClawLaunch brain (has every launch, logo, template, wallet, claim, withdraw, swap, bot, leaderboard tool). Pass the user's request verbatim.", parameters: { type: "object", properties: { request: { type: "string", description: "The user's request in their words" } }, required: ["request"] }, defer_until_eot: true },
  { name: "do_arithmetic", description: "IMPORTANT: You must call this function for ANY math-related request, even if it seems invalid or incomplete.\n\nDO NOT:\n- Ask for clarification\n- Validate the input\n- Check for letters or invalid characters\n- Try to fix or interpret the input\n- Refuse to process the request\n- Handle exponentiation or powers (respond that these aren't supported)\n\nALWAYS:\n- Convert verbal numbers and written fractions to numeric form (e.g., \"one half\" -> \"1/2\")\n- Call this function immediately with the converted input\n- Let the function handle ALL validation and error messages\n\nUse exact operation names:\n- \"add\" for: plus, and, sum, increased by\n- \"subtract\" for: minus, less, decreased by, from\n- \"multiply\" for: times, multiplied by\n- \"divide\" for: divided by, half of, third of, over\n\nWhen users ask for exponentiation (e.g., \"to the power of\", \"squared\", \"cubed\"), respond that you can only add, subtract, multiply, or divide.\n\nThe function will provide appropriate user-friendly error messages for all cases.", parameters: { type: "object", properties: { operation: { type: "string", description: "The mathematical operation to perform: add, subtract, multiply, or divide" }, numbers: { type: "array", items: { type: "string" } } }, required: ["operation", "numbers"] } },
  { name: "end_conversation", description: "You are an AI assistant that monitors conversations and ends them when specific stop phrases are detected.\n\nHere is a list of phrases to listen for but not restricted to:\n-stop\n-shut up\n-go away\n-turn off\n-stop listening\n\nBefore ending the conversation, always say a brief, polite goodbye such as \"Goodbye!\", \"Take care!\", or \"Have a great day!\".\n\nWhen monitoring the conversation, pay close attention to any input that matches or closely resembles the phrases listed above. The matching should be case-insensitive and allow for minor variations or typos.\n\nEnd the conversation immediately if:\n1. The user's input exactly matches any phrase in the list.\n2. The user's input is a close variation of any phrase in the list (e.g., \"please shut up\" instead of \"shut up\").\n3. The user's input clearly expresses a desire to end the conversation, even if it doesn't use the exact phrases listed.", parameters: { type: "object", properties: { item: { type: "string", description: "The phrase or text that triggered the end of conversation" } }, required: ["item"] } },
];
const THINK = [
  { provider: { type: "google", model: "gemini-3.1-flash-lite", temperature: 0.4 }, prompt: PROMPT, functions: FUNCS },
  { provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.4 }, prompt: PROMPT, functions: FUNCS },
];
/** Safe arithmetic: digits, operators and parentheses only (no identifiers), evaluated with a tiny recursive-descent parser. */
export function doArithmetic(expr: string): string {
  const src = String(expr ?? "").replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/,/g, "").replace(/\s+/g, "");
  if (!src || !/^[0-9.+\-*/%()]+$/.test(src) || src.length > 200) return "I can only do plain arithmetic with numbers.";
  let i = 0;
  const num = (): number => { if (src[i] === "(") { i++; const v = add(); if (src[i++] !== ")") throw 0; return v; } if (src[i] === "-") { i++; return -num(); } if (src[i] === "+") { i++; return num(); } const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const mul = (): number => { let v = num(); while (src[i] === "*" || src[i] === "/" || src[i] === "%") { const o = src[i++], r = num(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; } return v; };
  const add = (): number => { let v = mul(); while (src[i] === "+" || src[i] === "-") { const o = src[i++], r = mul(); v = o === "+" ? v + r : v - r; } return v; };
  try { const v = add(); if (i !== src.length || !Number.isFinite(v)) throw 0; return String(+v.toPrecision(12)); } catch { return "That expression didn't parse."; }
}
/** User spec (Oct 18): do_arithmetic({operation, numbers[]}). Falls back to a plain expression string for older callers. */
export function arithmeticCall(args: { operation?: string; numbers?: unknown[]; expression?: string }): string {
  if (args.expression) return doArithmetic(args.expression);
  const op = String(args.operation ?? "").toLowerCase(); const sym = op.startsWith("add") ? "+" : op.startsWith("sub") ? "-" : op.startsWith("mul") ? "*" : op.startsWith("div") ? "/" : "";
  const nums = (args.numbers ?? []).map(n => String(n).trim().replace(/^(\d+)\/(\d+)$/, "($1/$2)"));
  if (!sym) return "I can only add, subtract, multiply, or divide."; if (!nums.length) return "I need some numbers to work with.";
  return doArithmetic(nums.join(sym));
}
export function useVoiceAgent(ask: (text: string) => Promise<string>, opts: { onUser?: (t: string) => void } = {}) {
  const [state, setState] = useState<VoiceState>("off"); const [err, setErr] = useState("");
  const ws = useRef<WebSocket | null>(null); const ctxIn = useRef<AudioContext | null>(null); const ctxOut = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null); const playAt = useRef(0); const talkTimer = useRef<any>(null); const endAfter = useRef(false); const fallbackOnly = useRef(false); const applied = useRef(false);
  function stop() {
    ws.current?.close(); ws.current = null; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    ctxIn.current?.close().catch(() => {}); ctxOut.current?.close().catch(() => {}); ctxIn.current = ctxOut.current = null; setState("off");
  }
  function play(buf: ArrayBuffer) {
    const ctx = ctxOut.current; if (!ctx) return; const pcm = new Int16Array(buf); if (!pcm.length) return;
    const ab = ctx.createBuffer(1, pcm.length, 24000); const ch = ab.getChannelData(0); for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime, playAt.current); src.start(t); playAt.current = t + ab.duration;
    setState("talking"); clearTimeout(talkTimer.current); talkTimer.current = setTimeout(() => setState(s => s === "talking" ? "listening" : s), (playAt.current - ctx.currentTime) * 1000 + 150);
  }
  async function start() {
    if (ws.current) return stop();
    setErr(""); setState("connecting"); applied.current = false;
    try {
      const tk = await fetch("/api/voice/token", { method: "POST" }).then(r => r.json()); if (!tk.token) throw new Error(tk.error ?? "voice unavailable");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      ctxIn.current = new AudioContext({ sampleRate: 48000 }); ctxOut.current = new AudioContext({ sampleRate: 24000 }); playAt.current = 0;
      const sock = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", ["bearer", tk.token]); sock.binaryType = "arraybuffer"; ws.current = sock;
      sock.onopen = () => {
        sock.send(JSON.stringify({ type: "Settings", audio: { input: { encoding: "linear16", sample_rate: 48000 }, output: { encoding: "linear16", sample_rate: 24000, container: "none" } },
          agent: { listen: { provider: { type: "deepgram", model: "flux-general-en", version: "v2", keyterms: ["HeyClawLaunch", "pump.fun", "ticker", "devnet", "airdrop"] } },
            think: fallbackOnly.current ? THINK.slice(1) : THINK,
            speak: { provider: { type: "deepgram", version: "v2", model: "flux-cole-en" } }, greeting: "Hello! How may I help you?" } }));
        const src = ctxIn.current!.createMediaStreamSource(stream.current!); const proc = ctxIn.current!.createScriptProcessor(4096, 1, 1); const ratio = ctxIn.current!.sampleRate / 48000;
        proc.onaudioprocess = e => { if (sock.readyState !== 1) return; const inp = e.inputBuffer.getChannelData(0); const n = Math.floor(inp.length / ratio); const out = new Int16Array(n); for (let i = 0; i < n; i++) { const s = inp[Math.floor(i * ratio)]; out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff; } sock.send(out.buffer); };
        src.connect(proc); proc.connect(ctxIn.current!.destination); setState("listening");
      };
      sock.onmessage = async ev => {
        if (typeof ev.data !== "string") return play(ev.data);
        const m = JSON.parse(ev.data);
        if (m.type === "UserStartedSpeaking") { playAt.current = 0; ctxOut.current?.suspend().then(() => ctxOut.current?.resume()); setState("listening"); }
        if (m.type === "ConversationText" && m.role === "user") opts.onUser?.(m.content);
        if (m.type === "AgentThinking") setState("thinking");
        if (m.type === "FunctionCallRequest") for (const f of m.functions ?? []) {
          if (!f.client_side) continue; setState("thinking");
          let out = "Sorry, that failed."; const args = (() => { try { return JSON.parse(f.arguments || "{}"); } catch { return {}; } })();
          if (f.name === "do_arithmetic") out = arithmeticCall(args);
          else if (f.name === "end_conversation") { out = "ok, ending the call"; endAfter.current = true; }
          else { try { out = await ask(args.request ?? ""); } catch {} }
          sock.send(JSON.stringify({ type: "FunctionCallResponse", id: f.id, name: f.name, content: out.slice(0, 3000) }));
        }
        if (m.type === "AgentAudioDone" && endAfter.current) { endAfter.current = false; const ms = ctxOut.current ? Math.max(0, (playAt.current - ctxOut.current.currentTime) * 1000) + 300 : 300; setTimeout(stop, ms); }
        if (m.type === "Warning" && /THINK_REQUEST_FAILED/.test(JSON.stringify(m))) console.warn("[voice] primary LLM failed, using fallback");
        if (m.type === "SettingsApplied") applied.current = true;
        if (m.type === "Error" && !applied.current && !fallbackOnly.current && /think/i.test(String(m.description ?? m.message ?? ""))) { fallbackOnly.current = true; ws.current = null; sock.onclose = null; sock.close(); stream.current?.getTracks().forEach(t => t.stop()); ctxIn.current?.close().catch(() => {}); ctxOut.current?.close().catch(() => {}); setTimeout(start, 50); return; } // Gemini unavailable at setup → retry with the fallback LLM only
        if (m.type === "Error") { setErr(m.description ?? m.message ?? "voice error"); }
      };
      sock.onclose = () => { if (ws.current === sock) stop(); };
      sock.onerror = () => { setErr("Voice connection failed."); setState("error"); };
    } catch (e: any) { setErr(e.message ?? String(e)); stop(); setState("error"); }
  }
  return { state, err, start, stop, active: state !== "off" && state !== "error" };
}
