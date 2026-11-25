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

/** FEAT-32 M5 (spec §6.14) — avisos al guardar el pack; no bloquean. */
export const PACK_WARNING_NOT_CHEAPER = "El pack sale igual o más caro que comprar suelto.";
export const PACK_WARNING_BELOW_COST = "El precio del pack está por debajo del costo de sus componentes.";

export function packWarnings(input: { price: number; componentsTotal: number | null; netPrice?: number | null; cost?: number | null }): string[] {
  const warnings: string[] = [];
  const { price, componentsTotal, netPrice, cost } = input;
  if (price > 0 && componentsTotal !== null && componentsTotal > 0 && round(price, 2) >= round(componentsTotal, 2)) warnings.push(PACK_WARNING_NOT_CHEAPER);
  if (price > 0 && cost !== null && cost !== undefined && netPrice !== null && netPrice !== undefined && netPrice < cost) warnings.push(PACK_WARNING_BELOW_COST);
  return warnings;
}

/** Disponible de una variante en un almacén (físico − reservado, nunca negativo). */
export interface PackStockRow {
  inventoryId: string;
  inventoryName: string | null;
  storeId: string | null;
  available: number;
}

/** Componente para el cálculo: FIXED una variante; CHOOSE sus permitidas (se suman). */
export interface PackStockComponent {
  productId: string;
  variantIds: string[];
  quantity: number;
  label: string;
}

export interface PackStockPreview {
  total: number;
  byWarehouse: Array<PackStockRow & { limiting: { productId: string; label: string } | null }>;
  limiting: { productId: string; label: string } | null;
}

/**
 * FEAT-32 M5 (spec §6.14) — disponible del pack en la ventana, igual que ms-products: por almacén, el mínimo de
 * (disponible del componente ÷ cantidad) hacia abajo; un componente sin fila en el almacén cuenta 0. El total suma
 * los almacenes. Limita: el componente con menos (Σ disponible ÷ cantidad); por almacén, el de ese almacén.
 */
export function packStockPreview(components: PackStockComponent[], stock: Map<string, PackStockRow[]>): PackStockPreview {
  const usable = components.filter((component) => component.variantIds.length > 0 && component.quantity > 0);
  if (usable.length === 0) return { total: 0, byWarehouse: [], limiting: null };
  const warehouses = new Map<string, PackStockRow>();
  for (const component of usable) {
    for (const variantId of component.variantIds) {
      for (const row of stock.get(variantId) ?? []) {
        if (!warehouses.has(row.inventoryId)) warehouses.set(row.inventoryId, { ...row, available: 0 });
      }
    }
  }
  const availableIn = (component: PackStockComponent, inventoryId: string | null) =>
    component.variantIds.reduce(
      (sum, variantId) =>
        sum + (stock.get(variantId) ?? []).filter((row) => inventoryId === null || row.inventoryId === inventoryId).reduce((acc, row) => acc + Math.max(0, row.available), 0),
      0,
    );
  const lowest = (inventoryId: string | null) => {
    let best: { packs: number; component: PackStockComponent } | null = null;
    for (const component of usable) {
      const packs = Math.floor(availableIn(component, inventoryId) / component.quantity);
      if (!best || packs < best.packs) best = { packs, component };
    }
    return best!;
  };
  const byWarehouse = [...warehouses.values()].map((warehouse) => {
    const low = lowest(warehouse.inventoryId);
    return { ...warehouse, available: low.packs, limiting: { productId: low.component.productId, label: low.component.label } };
  });
  byWarehouse.sort((a, b) => b.available - a.available || a.inventoryId.localeCompare(b.inventoryId));
  const low = lowest(null);
  return {
    total: byWarehouse.reduce((sum, row) => sum + row.available, 0),
    byWarehouse,
    limiting: { productId: low.component.productId, label: low.component.label },
  };
}
