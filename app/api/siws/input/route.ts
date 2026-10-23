import { limitIp } from "@/lib/ratelimit";
import { newSiwsInput, messageText } from "@/lib/auth/siws";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { { const busy = await limitIp(req, "siws", 60, 60); if (busy) return busy; } return Response.json(await newSiwsInput()); }
export async function POST(req: Request) { { const busy = await limitIp(req, "siws", 60, 60); if (busy) return busy; } const b = await req.json().catch(() => null); if (!b || typeof b !== "object") return Response.json({ error: "JSON body required" }, { status: 400 }); try { return new Response(messageText(b)); } catch { return Response.json({ error: "Invalid sign-in input" }, { status: 400 }); } }
