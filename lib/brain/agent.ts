import { generateText, tool, stepCountIs, jsonSchema } from "ai";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sql } from "@/lib/db";
import type { Ctx } from "@/lib/core/ctx";
import { toolDefs, type ToolName } from "@/lib/tools/defs";
import { runTool, type ToolOut } from "@/lib/tools/run";
import { sha } from "@/lib/core/drafts";
import { pickModel } from "./registry";
import { ownerModel } from "@/lib/core/llm-keys";
import { systemPrompt } from "./prompt";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type Pending = { id: string; tool: ToolName; summary: string };
export type AgentResult = { reply: string; pending?: Pending; toolCalls: { name: string; args: any; out: ToolOut }[]; draftId?: string | null; model: string };

const GATED = (name: ToolName, args: any) => name === "confirm_launch" || name === "claim_fees" || ((name === "withdraw" || name === "swap") && args?.confirm === true);
const YES = /^\s*(y|yes|yeah|yep|yup|sure|ok|okay|confirm(ed)?|do it|go( ahead)?|launch( it)?|send( it)?|approve(d)?|let'?s go|ja|si|sí|oui|da)\b[\s.!]*/i;
const argsHash = (name: string, args: any) => { const { confirm, user_confirmed, ...rest } = args ?? {}; return sha(name + JSON.stringify(rest, Object.keys(rest).sort())); };

function summarize(name: ToolName, args: any) {
  if (name === "confirm_launch") return `Launch the coin from draft ${args.draft_id} (permanent).`;
  if (name === "claim_fees") return "Claim all waiting creator fees into your wallet.";
  if (name === "withdraw") return `Withdraw ${args.amount} ${args.token ?? "SOL"} to ${args.to}.`;
  if (name === "swap") return `Swap ${args.amount} ${args.from ?? "SOL"} → ${args.to} (max slippage ${args.slippage_percent ?? 3}%).`;
  return name;
}
export async function createPending(ctx: Ctx, name: ToolName, args: any): Promise<Pending> {
  const id = randomBytes(9).toString("base64url");
  const summary = summarize(name, args);
  await sql`insert into pending_actions(id,owner_key,tool,args,args_hash,summary,expires_at) values(${id},${ctx.ownerKey},${name},${sql.json(args)},${argsHash(name, args)},${summary},now()+interval '15 minutes')`;
  return { id, tool: name, summary };
}
/** Executes a pending action the user approved with a button (only the owner can). */
export async function executePending(ctx: Ctx, id: string): Promise<{ out: ToolOut; tool: ToolName } | { error: string }> {
  const [p] = await sql`update pending_actions set used_at=now() where id=${id} and owner_key=${ctx.ownerKey} and used_at is null and expires_at>now() returning *`;
  if (!p) return { error: "This confirmation expired, was already used, or isn't yours." };
  const args = { ...p.args }; if (p.tool === "confirm_launch") args.user_confirmed = true; if (p.tool === "withdraw" || p.tool === "swap") args.confirm = true;
  return { out: await runTool(ctx, p.tool, args), tool: p.tool };
}

export async function runAgent(ctx: Ctx, messages: ChatMsg[], opts: { model?: string; draftId?: string | null; extraSystem?: string } = {}): Promise<AgentResult> {
  const own = await ownerModel(ctx.walletKey ?? ctx.ownerKey).catch(() => null); const { id: modelId, model } = own ?? pickModel(opts.model);
  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
  const userSaidYes = YES.test(lastUser);
  const calls: AgentResult["toolCalls"] = [];
  let pending: Pending | undefined; let draftId = opts.draftId ?? null;
  const defs = toolDefs();
  const tools: Record<string, any> = {};
  for (const name of Object.keys(defs) as ToolName[]) {
    const d = (defs as any)[name];
    tools[name] = tool({
      description: d.description,
      inputSchema: z.object(d.inputSchema),
      execute: async (args: any) => {
        let out: ToolOut;
        if (GATED(name, args)) {
          const h = argsHash(name, args);
          const [p] = await sql`select id from pending_actions where owner_key=${ctx.ownerKey} and tool=${name} and args_hash=${h} and used_at is null and expires_at>now() order by expires_at desc limit 1`;
          if (p && userSaidYes) { await sql`update pending_actions set used_at=now() where id=${p.id}`; out = await runTool(ctx, name, args); }
          else { pending = await createPending(ctx, name, args); out = { text: `NEEDS_CONFIRMATION: ${pending.summary}\nNothing was executed. Ask the user to confirm (a Confirm button is shown); only after a clear yes call this tool again with the same arguments.` }; }
        } else out = await runTool(ctx, name, args);
        if (out.data?.draft_id) draftId = out.data.draft_id as string;
        calls.push({ name, args, out });
        return out.isError ? `ERROR: ${out.text}` : out.text;
      },
    });
  }
  const system = systemPrompt() + (draftId ? `\nContext: the user's current draft_id is ${draftId}.` : "") + (ctx.walletKey ? `\nThe user is signed in${ctx.walletAddress ? ` with wallet ${ctx.walletAddress}` : ""}${ctx.xUsername ? ` and X @${ctx.xUsername}` : ""}.` : "\nThe user is not signed in (wallet tools will say not connected).") + (opts.extraSystem ? "\n" + opts.extraSystem : "");
  const r = await generateText({ model, system, messages: messages.slice(-30), tools, stopWhen: stepCountIs(8), temperature: 0.3 });
  return { reply: r.text || (pending ? `Please confirm: ${pending.summary}` : "…"), pending, toolCalls: calls, draftId, model: modelId };
}
