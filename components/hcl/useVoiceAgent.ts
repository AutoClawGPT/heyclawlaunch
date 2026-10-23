"use client";
// Deepgram Voice Agent in the browser: listens with Flux (flux-general-en v2), speaks with Flux TTS (flux-cole-en v2).
// Every request is routed through one client-side function, `heyclaw`, which calls OUR brain (/api/robot) with all
// launch / wallet / bot tools and the same confirm-before-acting rules. The spoken reply is whatever our brain says.
import { useRef, useState } from "react";
export type VoiceState = "off" | "connecting" | "listening" | "thinking" | "talking" | "error";
const PROMPT = `You are Claw, the voice of HeyClawLaunch, a pump.fun coin launcher on Solana devnet.
For ANY request about coins, launching, logos, templates, wallets, balances, fees, claiming, withdrawing, swapping, volume bots, the leaderboard or airdrops, call the heyclaw function with the user's request in their own words, then read its reply back naturally and briefly (skip long addresses and URLs: say "the link on screen").
Never invent results. Never say something launched or moved unless heyclaw said so. When heyclaw asks for a confirmation, ask the user out loud; if they clearly say yes, call heyclaw with "yes, confirm".
For small talk answer yourself in one or two short sentences.`;
export function useVoiceAgent(ask: (text: string) => Promise<string>, opts: { onUser?: (t: string) => void } = {}) {
  const [state, setState] = useState<VoiceState>("off"); const [err, setErr] = useState("");
  const ws = useRef<WebSocket | null>(null); const ctxIn = useRef<AudioContext | null>(null); const ctxOut = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null); const playAt = useRef(0); const talkTimer = useRef<any>(null);
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
    setErr(""); setState("connecting");
    try {
      const tk = await fetch("/api/voice/token", { method: "POST" }).then(r => r.json()); if (!tk.token) throw new Error(tk.error ?? "voice unavailable");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      ctxIn.current = new AudioContext(); ctxOut.current = new AudioContext({ sampleRate: 24000 }); playAt.current = 0;
      const sock = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", ["bearer", tk.token]); sock.binaryType = "arraybuffer"; ws.current = sock;
      sock.onopen = () => {
        sock.send(JSON.stringify({ type: "Settings", audio: { input: { encoding: "linear16", sample_rate: 16000 }, output: { encoding: "linear16", sample_rate: 24000, container: "none" } },
          agent: { listen: { provider: { type: "deepgram", model: "flux-general-en", version: "v2", keyterms: ["HeyClawLaunch", "pump.fun", "ticker", "devnet", "airdrop"] } },
            think: { provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.4 }, prompt: PROMPT, functions: [{ name: "heyclaw", description: "Ask the HeyClawLaunch brain (has every launch, logo, template, wallet, claim, withdraw, swap, bot, leaderboard tool). Pass the user's request verbatim.", parameters: { type: "object", properties: { request: { type: "string", description: "The user's request in their words" } }, required: ["request"] }, defer_until_eot: true }] },
            speak: { provider: { type: "deepgram", version: "v2", model: "flux-cole-en" } }, greeting: "Hey, I'm Claw. Want to launch a coin?" } }));
        const src = ctxIn.current!.createMediaStreamSource(stream.current!); const proc = ctxIn.current!.createScriptProcessor(4096, 1, 1); const ratio = ctxIn.current!.sampleRate / 16000;
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
          let out = "Sorry, that failed."; try { out = await ask(JSON.parse(f.arguments || "{}").request ?? ""); } catch {}
          sock.send(JSON.stringify({ type: "FunctionCallResponse", id: f.id, name: f.name, content: out.slice(0, 3000) }));
        }
        if (m.type === "Error") { setErr(m.description ?? m.message ?? "voice error"); }
      };
      sock.onclose = () => { if (ws.current === sock) stop(); };
      sock.onerror = () => { setErr("Voice connection failed."); setState("error"); };
    } catch (e: any) { setErr(e.message ?? String(e)); stop(); setState("error"); }
  }
  return { state, err, start, stop, active: state !== "off" && state !== "error" };
}
