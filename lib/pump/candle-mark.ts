// Mark price for a future candle builder: SOL per WHOLE token (6 dec token, 9 dec SOL).
export function markPriceFromReserves(vSol: bigint, vToken: bigint, tokenDecimals = 6): number {
  if (vToken === 0n) return 0;
  return (Number(vSol) / 1e9) / (Number(vToken) / 10 ** tokenDecimals);
}
