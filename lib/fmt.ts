// Display formatters shared by token page, explore cards and charts (pure, client + server safe).
const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** pump.fun/DexScreener price: $0.0₇3624 for tiny values (subscript = number of zeros after "0."). */
export function priceSub(v: number | null | undefined, prefix = "$"): string {
  if (v == null || !isFinite(v)) return "—"; if (v === 0) return prefix + "0";
  if (v >= 1) return prefix + v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (v >= 0.001) return prefix + v.toPrecision(4).replace(/0+$/, "");
  const z = Math.floor(-Math.log10(v)); const digits = Math.round(v * 10 ** (z + 4)).toString().slice(0, 4).replace(/0+$/, "") || "0";
  return `${prefix}0.0${String(z).split("").map(d => SUB[+d]).join("")}${digits}`;
}
/** $36.2, $1.2K, $3.4M */
export function usdCompact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—"; const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`; if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`; if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${v.toFixed(a >= 100 ? 0 : 1)}`; if (a === 0) return "$0"; return a >= 0.01 ? `$${v.toFixed(2)}` : "<$0.01";
}
export function numCompact(v: number | null | undefined, d = 1): string {
  if (v == null || !isFinite(v)) return "—"; const a = Math.abs(v);
  return a >= 1e9 ? (v / 1e9).toFixed(d) + "B" : a >= 1e6 ? (v / 1e6).toFixed(d) + "M" : a >= 1e3 ? (v / 1e3).toFixed(d) + "K" : a >= 1 ? v.toFixed(a >= 100 ? 0 : 2) : v.toFixed(4);
}
export const pct = (v: number | null | undefined) => v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
export const shortAddr = (a?: string | null) => a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "—";
export const agoS = (t: number | string | Date) => { const s = Math.max(1, (Date.now() - +new Date(t)) / 1000); return s < 60 ? `${Math.floor(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
