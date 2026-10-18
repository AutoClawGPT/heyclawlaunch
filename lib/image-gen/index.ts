import { generateText } from "ai";
import { UserError } from "@/lib/core/validate";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { pinLogoBytes, sniff } from "@/lib/core/logo";
import { gatewayUrl } from "@/lib/ipfs";
import { registry } from "@/lib/brain/registry";

export type ImageOpts = { model?: string; size?: string; seed?: number };
export type GenImage = { bytes: Uint8Array; type: string; model: string; provider: string };
export interface ImageProvider { name: string; generate(prompt: string, o: ImageOpts): Promise<GenImage> }
export class ImageGenError extends UserError {}

const POLL = process.env.POLLINATIONS_BASE_URL ?? "https://gen.pollinations.ai";
export const DEFAULT_IMAGE_MODEL = () => process.env.IMAGE_MODEL ?? "black-forest-labs/flux.2-klein-4b";

/** Pollinations (OpenAI-compatible /v1/images/generations, falls back to GET /image/{prompt}). Auth: Authorization: Bearer POLLINATIONS_API_KEY. */
const pollinations: ImageProvider = {
  name: "pollinations",
  async generate(prompt, o) {
    const key = process.env.POLLINATIONS_API_KEY; if (!key) throw new ImageGenError("Image generation isn't configured (POLLINATIONS_API_KEY missing).");
    const model = o.model ?? DEFAULT_IMAGE_MODEL(), size = o.size ?? "1024x1024";
    const auth = { Authorization: `Bearer ${key}` };
    let r = await fetch(`${POLL}/v1/images/generations`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ model, prompt, size, n: 1, response_format: "b64_json", ...(o.seed != null ? { seed: o.seed } : {}) }), signal: AbortSignal.timeout(120_000) });
    if (r.ok) {
      const j: any = await r.json(); const d = j.data?.[0];
      let bytes: Uint8Array | null = d?.b64_json ? Buffer.from(d.b64_json, "base64") : null;
      if (!bytes && d?.url) bytes = new Uint8Array(await (await fetch(d.url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
      if (bytes) return { bytes, type: sniff(bytes) ?? "image/png", model, provider: "pollinations" };
    }
    const err = r.ok ? "" : (await r.text()).slice(0, 300);
    const [w, h] = size.split("x");
    const q = new URLSearchParams({ model, width: w, height: h, nologo: "true", ...(o.seed != null ? { seed: String(o.seed) } : {}) });
    r = await fetch(`${POLL}/image/${encodeURIComponent(prompt)}?${q}`, { headers: auth, signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new ImageGenError(`Image generation failed (HTTP ${r.status}). ${err || (await r.text()).slice(0, 200)}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!sniff(bytes)) throw new ImageGenError("Image generation returned something that isn't an image.");
    return { bytes, type: sniff(bytes)!, model, provider: "pollinations" };
  },
};
/** OpenAI images API (pluggable; IMAGE_PROVIDER=openai). */
const openai: ImageProvider = {
  name: "openai",
  async generate(prompt, o) {
    const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: o.model ?? "gpt-image-1", prompt, size: o.size ?? "1024x1024", n: 1 }) });
    if (!r.ok) throw new ImageGenError(`OpenAI image failed (HTTP ${r.status})`);
    const bytes = Buffer.from((await r.json() as any).data[0].b64_json, "base64"); return { bytes, type: sniff(bytes) ?? "image/png", model: o.model ?? "gpt-image-1", provider: "openai" };
  },
};
const providers: Record<string, ImageProvider> = { pollinations, openai };
export const imageProvider = () => providers[process.env.IMAGE_PROVIDER ?? "pollinations"] ?? pollinations;

export const logoPrompt = (subject: string) => `Square crypto memecoin logo for "${subject}". Bold, centered single mascot or emblem, clean flat vector style, thick outlines, vibrant colors, plain solid background, no text, no letters, no watermark.`;

/** Generate a square logo and pin it to IPFS. Returns a gateway URL that prepare_launch's logo_image accepts directly. */
export async function generateLogo(prompt: string, o: ImageOpts = {}) {
  const img = await imageProvider().generate(prompt, { size: "1024x1024", ...o });
  const cid = await pinLogoBytes(img.bytes);
  return { cid, url: gatewayUrl(cid), ipfs: `ipfs://${cid}`, model: img.model, provider: img.provider, bytes: img.bytes, type: img.type };
}

export type TokenIdea = { name: string; ticker: string; description: string };
const IDEA_MODEL = () => process.env.IDEA_MODEL ?? (process.env.POLLINATIONS_API_KEY ? "pollinations:openai/gpt-5.4-nano" : process.env.DEFAULT_MODEL ?? "river:deepseek-ai/DeepSeek-V4.1-Flash");
function ideaModel() {
  const id = IDEA_MODEL();
  if (id.startsWith("pollinations:")) { return createOpenAICompatible({ name: "pollinations", baseURL: `${POLL}/v1`, apiKey: process.env.POLLINATIONS_API_KEY })(id.slice(13)); }
  return registry().languageModel(id as any);
}
export async function generateIdea(theme?: string): Promise<TokenIdea> {
  let text = "";
  try {
    ({ text } = await generateText({ model: ideaModel(), temperature: 1, maxOutputTokens: 300, prompt: `Invent a fun, original pump.fun memecoin${theme ? ` about: ${theme}` : ""}. Reply with ONLY minified JSON: {"name": "<=32 chars", "ticker": "2-10 uppercase letters/digits", "description": "one or two punchy sentences, <=200 chars"}` }));
  } catch (e: any) { if (!theme) throw new ImageGenError(`Idea generation failed: ${e.message}`); }
  const m = text.match(/\{[\s\S]*\}/); let j: any = {};
  try { j = m ? JSON.parse(m[0]) : {}; } catch {}
  const base = (theme ?? "Moon Cat").trim();
  const name = String(j.name ?? base).replace(/[^\p{L}\p{N} .'!&-]/gu, "").slice(0, 32).trim() || "Moon Cat";
  const ticker = String(j.ticker ?? name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "MOON";
  const description = String(j.description ?? `${name}, launched by chatting with HeyClawLaunch.`).slice(0, 200);
  return { name, ticker: ticker.length < 2 ? ticker + "X" : ticker, description };
}
export async function generateTokenIdea(theme?: string, o: ImageOpts = {}) {
  const idea = await generateIdea(theme);
  const logo = await generateLogo(logoPrompt(`${idea.name} ($${idea.ticker}): ${idea.description}`), o);
  return { ...idea, logo };
}

/** Site art: Grok Imagine first (ART_MODEL), falls back to the default model when the paid model is unavailable (e.g. HTTP 402). */
export const ART_MODEL = () => process.env.ART_MODEL ?? "x-ai/grok-imagine-image";
export async function generateArt(prompt: string, size = "1536x1024") {
  try { return await imageProvider().generate(prompt, { model: ART_MODEL(), size }); }
  catch (e: any) { if (!/HTTP (402|403|404|429)/.test(String(e.message))) throw e; const r = await imageProvider().generate(prompt, { size }); return { ...r, fallbackFrom: ART_MODEL(), fallbackReason: String(e.message).slice(0, 120) }; }
}
