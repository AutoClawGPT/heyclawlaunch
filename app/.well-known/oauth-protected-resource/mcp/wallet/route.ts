import { prMetadata } from "@/lib/auth/oauth"; import { json, options } from "@/lib/http";
export const dynamic = "force-dynamic"; export const GET = () => json(prMetadata("/mcp/wallet")); export const OPTIONS = options;
