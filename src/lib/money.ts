// FEAT-24 H0 — soles con dos decimales en todo el módulo (antes "$").
export function formatMoney(value: number | string | null | undefined): string {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return "S/ 0.00";
  }
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(numeric);
}
