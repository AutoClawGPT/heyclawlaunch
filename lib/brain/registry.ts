import { createProviderRegistry } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";

/** Model ids are "provider:model". Default: River (OpenAI-compatible) DeepSeek V4.1 Flash. Any OpenAI-compatible endpoint can be added via CUSTOM_LLM_BASE_URL/CUSTOM_LLM_API_KEY ("custom:<model>"). */
let _reg: any;
export function registry() {
  if (_reg) return _reg;
  const providers: Record<string, any> = {
    river: createOpenAICompatible({ name: "river", baseURL: process.env.RIVER_BASE_URL ?? "https://api.river.ai/v1", apiKey: process.env.RIVER_API_KEY }),
    openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    anthropic: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    google: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY }),
    xai: createXai({ apiKey: process.env.XAI_API_KEY }),
    openrouter: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY }),
    ollama: createOllama({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api" }),
    pollinations: createOpenAICompatible({ name: "pollinations", baseURL: `${process.env.POLLINATIONS_BASE_URL ?? "https://gen.pollinations.ai"}/v1`, apiKey: process.env.POLLINATIONS_API_KEY }),
    groq: createOpenAICompatible({ name: "groq", baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY }),
  };
  if (process.env.CUSTOM_LLM_BASE_URL) providers.custom = createOpenAICompatible({ name: "custom", baseURL: process.env.CUSTOM_LLM_BASE_URL, apiKey: process.env.CUSTOM_LLM_API_KEY });
  return (_reg = createProviderRegistry(providers));
}
export const DEFAULT_MODEL = () => process.env.DEFAULT_MODEL ?? "river:deepseek-ai/DeepSeek-V4.1-Flash";
export const allowedModels = () => (process.env.ALLOWED_MODELS ?? DEFAULT_MODEL()).split(",").map(s => s.trim()).filter(Boolean);
export function pickModel(requested?: string) {
  const id = requested && allowedModels().includes(requested) ? requested : DEFAULT_MODEL();
  return { id, model: registry().languageModel(id as any) };
}
