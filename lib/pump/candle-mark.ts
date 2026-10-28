// Mark price for a future candle builder: SOL per WHOLE token (6 dec token, 9 dec SOL).
export function markPriceFromReserves(vSol: bigint, vToken: bigint, tokenDecimals = 6): number {
  if (vToken === 0n) return 0;
  return (Number(vSol) / 1e9) / (Number(vToken) / 10 ** tokenDecimals);
}

// pump.fun TradeEvent (Anchor `emit!` → "Program data: <base64>" log line). Fixed-offset prefix of the IDL layout:
// disc[8] mint[32] sol_amount u64 token_amount u64 is_buy u8 user[32] timestamp i64 virtual_sol_reserves u64 virtual_token_reserves u64
const TRADE_EVENT_DISC = [189, 219, 127, 211, 78, 230, 97, 238];
export interface TradeEventReserves { mint: Uint8Array; isBuy: boolean; vSol: bigint; vToken: bigint }
function u64le(b: Uint8Array, o: number): bigint { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]); return v; }
/** Post-trade virtual reserves from a tx's log messages (first TradeEvent, optionally for `mintBytes`). null if absent. */
export function tradeEventReservesFromLogs(logs: readonly string[] | null | undefined, mintBytes?: Uint8Array): TradeEventReserves | null {
  for (const line of logs ?? []) {
    if (!line.startsWith("Program data: ")) continue;
    let d: Uint8Array; try { d = Uint8Array.from(Buffer.from(line.slice(14), "base64")); } catch { continue; }
    if (d.length < 113 || TRADE_EVENT_DISC.some((x, i) => d[i] !== x)) continue;
    const mint = d.slice(8, 40);
    if (mintBytes && mintBytes.some((x, i) => mint[i] !== x)) continue;
    return { mint, isBuy: d[56] === 1, vSol: u64le(d, 97), vToken: u64le(d, 105) };
  }
  return null;
}
