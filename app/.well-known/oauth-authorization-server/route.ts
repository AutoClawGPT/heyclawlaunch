import { asMetadata } from "@/lib/auth/oauth"; import { json, options } from "@/lib/http";
export const dynamic = "force-dynamic"; export const GET = () => json(asMetadata()); export const OPTIONS = options;
