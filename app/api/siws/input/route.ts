import { newSiwsInput, messageText } from "@/lib/auth/siws";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json(await newSiwsInput()); }
export async function POST(req: Request) { return new Response(messageText(await req.json())); }
