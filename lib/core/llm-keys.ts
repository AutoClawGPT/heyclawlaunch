import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { sql } from "@/lib/db";
import { sealSecret, openSecret } from "@/lib/keystore";
import { UserError } from "./validate";

/** Bring-your-own LLM key. Default brain is River; a saved key (encrypted at rest, never returned) switches that owner to their provider. */
export const PROVIDERS: Record<string, { model: string; make: (k: string) => any }> = {
  openai: { model: "gpt-4o-mini", make: k => createOpenAI({ apiKey: k }) },
  anthropic: { model: "claude-3-5-haiku-latest", make: k => createAnthropic({ apiKey: k }) },
  google: { model: "gemini-2.0-flash", make: k => createGoogleGenerativeAI({ apiKey: k }) },
  xai: { model: "grok-3-mini", make: k => createXai({ apiKey: k }) },
  openrouter: { model: "openai/gpt-4o-mini", make: k => createOpenRouter({ apiKey: k }) },
  groq: { model: "llama-3.3-70b-versatile", make: k => createOpenAICompatible({ name: "groq", baseURL: "https://api.groq.com/openai/v1", apiKey: k }) },
};
export async function setLlmKey(ownerKey: string, b: { provider?: string; model?: string; api_key?: string; clear?: boolean }) {
  if (b.clear) { await sql`delete from llm_keys where owner_key=${ownerKey}`; return { provider: "river", custom: false }; }
  const p = String(b.provider ?? "").toLowerCase(); if (!PROVIDERS[p]) throw new UserError(`provider must be one of: ${Object.keys(PROVIDERS).join(", ")}.`);
  const k = String(b.api_key ?? "").trim(); if (k.length < 12 || k.length > 400) throw new UserError("api_key looks wrong.");
  const model = b.model ? String(b.model).slice(0, 100) : PROVIDERS[p].model; const s = sealSecret(k);
  await sql`insert into llm_keys(owner_key,provider,model,ciphertext,iv,wrapped_dek,dek_iv) values(${ownerKey},${p},${model},${s.ciphertext},${s.iv},${s.wrapped_dek},${s.dek_iv}) on conflict(owner_key) do update set provider=excluded.provider,model=excluded.model,ciphertext=excluded.ciphertext,iv=excluded.iv,wrapped_dek=excluded.wrapped_dek,dek_iv=excluded.dek_iv,updated_at=now()`;
  return { provider: p, model, custom: true };
}
export async function llmInfo(ownerKey: string) { const [r] = await sql`select provider,model,updated_at from llm_keys where owner_key=${ownerKey}`; return r ? { provider: r.provider, model: r.model, custom: true, updated_at: r.updated_at } : { provider: "river", model: "default", custom: false }; }
export async function ownerModel(ownerKey?: string): Promise<{ id: string; model: any } | null> {
  if (!ownerKey) return null; const [r] = await sql`select * from llm_keys where owner_key=${ownerKey}`; if (!r || !PROVIDERS[r.provider]) return null;
  const prov = PROVIDERS[r.provider].make(openSecret(r)); return { id: `${r.provider}:${r.model}`, model: prov.languageModel ? prov.languageModel(r.model) : prov(r.model) };
}
