// FEAT-24 H0 — Shopify pone "Title: Default Title" a los productos sin
// variantes. No se muestra. Misma normalización que la unificación
// (attributeSignature en ms-products).
const normalize = (value: string) =>
  value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

export function isDefaultTitleValue(value: unknown): boolean {
  return typeof value === "string" && normalize(value) === "default title";
}

export function visibleVariantAttributes(attrs: Record<string, unknown> | null | undefined): Array<[string, string]> {
  return Object.entries(attrs ?? {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "" && !isDefaultTitleValue(value))
    .map(([key, value]) => [key, String(value)]);
}

export function formatVariantLabel(attrs: Record<string, unknown> | null | undefined, separator = " · "): string {
  return visibleVariantAttributes(attrs).map(([key, value]) => `${key}: ${value}`).join(separator);
}
