/**
 * FEAT-24 H9 (H9-D3) — margen del pack en el navegador, igual que ms-products (`pack-math.ts`): el precio
 * va con IGV y el costo promedio sin IGV, así que si la empresa está afecta el margen se mide sobre
 * precio ÷ 1,18. El servidor vuelve a medirlo al guardar (409 `PACK_LOW_MARGIN`).
 */
import type { PackMarginStatus } from "@/services/packsService";

export const IGV_RATE = 0.18;

export interface PackMarginInput {
  price: number;
  components: Array<{ variantId: string; quantity: number }>;
  /** Costo promedio sin IGV por variante; `null` o ausente = sin costo. */
  costs: Map<string, number | null>;
  rules: { minMargin: number; igvAffected: boolean };
}

export interface PackMarginResult {
  cost: number | null;
  netPrice: number;
  margin: number | null;
  minMargin: number;
  status: Exclude<PackMarginStatus, "no_disponible">;
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function packMargin({ price, components, costs, rules }: PackMarginInput): PackMarginResult {
  const netPrice = rules.igvAffected ? round(price / (1 + IGV_RATE), 4) : price;
  const base = { netPrice, minMargin: rules.minMargin };
  const missing = components.some((component) => (costs.get(component.variantId) ?? null) === null);
  if (missing || components.length === 0) return { ...base, cost: null, margin: null, status: "sin_costo" };
  const cost = round(
    components.reduce((sum, component) => sum + (costs.get(component.variantId) ?? 0) * component.quantity, 0),
    4,
  );
  if (!(netPrice > 0)) return { ...base, cost, margin: null, status: cost > 0 ? "bajo_costo" : "sin_precio" };
  const margin = round((netPrice - cost) / netPrice, 4);
  const status = netPrice < cost ? "bajo_costo" : margin < rules.minMargin ? "bajo_minimo" : "ok";
  return { ...base, cost, margin, status };
}

/** Guardar con este estado exige confirmación explícita. */
export const needsMarginConfirmation = (status: PackMarginStatus | undefined) =>
  status === "bajo_costo" || status === "bajo_minimo";

export const soles = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `S/ ${value.toFixed(2)}`;

export const percent = (value: number | null | undefined, decimals = 0) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(decimals)} %`;

/** Texto de la alerta de margen (vacío si no hay alerta). */
export function marginAlert(result: { status?: PackMarginStatus; margin?: number | null; minMargin?: number; netPrice?: number; cost?: number | null }): string {
  if (result.status === "bajo_costo") {
    return `El precio${result.netPrice !== undefined ? ` sin IGV (${soles(result.netPrice)})` : ""} es menor que el costo de los componentes (${soles(result.cost ?? null)}).`;
  }
  if (result.status === "bajo_minimo") {
    return `El margen (${percent(result.margin ?? null, 1)}) queda bajo el mínimo de ${percent(result.minMargin ?? null)}.`;
  }
  return "";
}

/** Etiqueta de una variante: «Producto · Talla M / Rojo». */
export function variantLabel(productName: string, attributes: Record<string, string> | null | undefined): string {
  const values = Object.values(attributes ?? {}).filter((value) => value && value !== "Default Title");
  return values.length ? `${productName} · ${values.join(" / ")}` : productName;
}
