export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

export function axisSoles(value: number): string {
  if (value >= 1000) return `S/${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`;
  return `S/${Math.round(value)}`;
}

export function axisNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value * 10) / 10);
}

export const MAX_SERIES_LINEA = 4;

export const SERIES_COLORS = [
  "var(--pc-series-1)",
  "var(--pc-series-2)",
  "var(--pc-series-3)",
  "var(--pc-series-4)",
  "var(--pc-series-5)",
  "var(--pc-series-6)",
  "var(--pc-series-7)",
  "var(--pc-series-8)",
];

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
