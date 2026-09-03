export function fmtMoney(n: number, decimals = 0): string {
  const abs = Math.abs(Number(n) || 0);
  const sign = n < 0 ? "−" : "";
  return `${sign}S/ ${abs.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${Number(n).toFixed(decimals)}%`;
}

export function fmtNum(n: number): string {
  return Number(n).toLocaleString("es-PE");
}
