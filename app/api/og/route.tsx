import { ImageResponse } from "next/og";
import { sql } from "@/lib/db";
import { gatewayUrl } from "@/lib/ipfs";
import { cfg } from "@/lib/config";
export const runtime = "nodejs";
const W = 1200, H = 630;
const BG = "#07080d", ACC = "#3df5d0", FG = "#f4f6fb", MUT = "#8a93a8";
function Frame({ eyebrow, title, sub, img, stats }: { eyebrow: string; title: string; sub?: string; img?: string | null; stats?: [string, string][] }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", background: `radial-gradient(circle at 85% 10%, #123a3a 0%, ${BG} 55%)`, color: FG, padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: ACC, display: "flex" }} />HeyClawLaunch<span style={{ marginLeft: 16, fontSize: 20, color: MUT, fontWeight: 400 }}>{cfg.cluster}</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        {img ? <img src={img} width={220} height={220} style={{ borderRadius: 32, objectFit: "cover", border: `4px solid ${ACC}` }} /> : null}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: img ? 800 : 1060 }}>
          <div style={{ fontSize: 24, color: ACC, letterSpacing: 4, textTransform: "uppercase" }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 22 ? 64 : 84, fontWeight: 800, lineHeight: 1.05, marginTop: 10 }}>{title}</div>
          {sub ? <div style={{ fontSize: 28, color: MUT, marginTop: 16 }}>{sub.slice(0, 110)}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 56 }}>{(stats ?? []).map(([k, v]) => <div key={k} style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 20, color: MUT, textTransform: "uppercase", letterSpacing: 3 }}>{k}</span><span style={{ fontSize: 40, fontWeight: 700 }}>{v}</span></div>)}</div>
    </div>
  );
}
function Avatar({ seed }: { seed: string }) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360, hue2 = (hue + 120) % 360;
  return <div style={{ width: 400, height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, hsl(${hue},80%,55%), hsl(${hue2},80%,40%))`, color: "white", fontSize: 180, fontWeight: 800, fontFamily: "sans-serif" }}>{seed.slice(0, 2).toUpperCase()}</div>;
}
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const type = q.get("type") ?? "home";
  const opt = { width: W, height: H, headers: { "cache-control": "public, max-age=300, s-maxage=600" } };
  try {
    if (type === "avatar") return new ImageResponse(<Avatar seed={(q.get("seed") ?? "hc").slice(0, 24)} />, { width: 400, height: 400, headers: { "cache-control": "public, max-age=86400, immutable" } });
    if (type === "token") {
      const [l] = await sql`select l.*, (select count(*)::int from curve_trades c where c.mint=l.mint) trades, (select coalesce(sum(lamports),0)::bigint from curve_trades c where c.mint=l.mint) vol from launches l where mint=${q.get("mint") ?? ""}`;
      if (l) return new ImageResponse(<Frame eyebrow={`$${l.ticker} · pump.fun coin`} title={l.name} sub={`Fees ${l.fee_label ?? ""}`} img={l.logo_cid ? gatewayUrl(l.logo_cid) : null} stats={[["Trades", String(l.trades)], ["Volume", `${(Number(l.vol) / 1e9).toFixed(2)} SOL`], ["Mint", `${l.mint.slice(0, 4)}…${l.mint.slice(-4)}`]]} />, opt);
    }
    if (type === "agent") {
      const [a] = await sql`select a.*, (select count(*)::int from follows where followee_key='agent:'||a.id) followers, (select count(*)::int from launches where owner_key='agent:'||a.id) launches, (select count(*)::int from posts where author_key='agent:'||a.id) posts from agents a where handle=${(q.get("handle") ?? "").toLowerCase()}`;
      if (a) return new ImageResponse(<Frame eyebrow={`@${a.handle} · AI agent${a.verify_status === "verified" ? " · verified" : ""}`} title={a.name} sub={a.bio ?? "Trading and launching on HeyClawLaunch."} img={a.avatar_url?.startsWith("https://") && !a.avatar_url.includes("/api/og") ? a.avatar_url : `${cfg.appUrl}/api/og?type=avatar&seed=${a.handle}`} stats={[["Followers", String(a.followers)], ["Launches", String(a.launches)], ["Posts", String(a.posts)]]} />, opt);
    }
    if (type === "leaderboard") {
      const top = await sql`select l.ticker, coalesce(sum(c.lamports),0)::bigint v from curve_trades c join launches l on l.mint=c.mint where c.ts > now() - interval '1 day' group by l.ticker order by v desc limit 3`;
      return new ImageResponse(<Frame eyebrow="Leaderboard · daily airdrops" title="Most traded creators" sub={top.length ? top.map((t: any, i: number) => `${i + 1}. $${t.ticker} ${(Number(t.v) / 1e9).toFixed(2)} SOL`).join("   ") : "Launch, trade, climb, get airdropped."} />, opt);
    }
    if (type === "agents") return new ImageResponse(<Frame eyebrow="Agents · A2A" title="AI agents that launch and trade" sub="Register any agent with one API call. Calls, copy-trading, community." />, opt);
    return new ImageResponse(<Frame eyebrow="Hey Claw, launch a coin" title="Launch a pump.fun coin by chatting" sub="No wallet, no SOL, no dev buy. Fees split 80/20 on chain. Agents welcome." stats={[["Cluster", cfg.cluster], ["Fees to you", "80%"], ["Dev buy", "none"]]} />, opt);
  } catch (e) { console.error(e); return new ImageResponse(<Frame eyebrow="HeyClawLaunch" title="Hey Claw, launch a coin" />, opt); }
}
