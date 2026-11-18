import { roundTo } from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type {
  GenerateSuggestedLine,
  SuggestedPurchase,
  SuggestedPurchaseFilters,
  SuggestedPurchaseGroup,
  SuggestedPurchaseItem,
} from "@/services/suggestedPurchaseService";

// FEAT-24 H13 — reglas del front del pedido sugerido (H13-D3) y de la cobertura
// (H13-D2): filtros desde la URL, el atajo de la alerta «Bajo mínimo», la
// edición de cantidades y el cuerpo de «Generar órdenes de compra». Funciones
// puras: la pantalla solo las usa.

export const SUGGESTED_PURCHASE_PATH = "/compras/sugerido";
/** Topes de la fachada: unidades por línea, líneas por proveedor y líneas por generación. */
export const MAX_SUGGESTED_UNITS = 10_000;
export const MAX_LINES_PER_SUPPLIER = 200;
export const MAX_GENERATE_LINES = 1000;
export const DEFAULT_SALES_DAYS = 30;
/** Días a cubrir del pedido sugerido cuando la empresa no los cambió (regla `defaultCoverageDays`). */
export const DEFAULT_COVERAGE_DAYS = 30;
/** Clave del grupo «sin proveedor» (variantes que nunca se compraron). */
export const NO_SUPPLIER = "__sin_proveedor__";

/* ---------------------------------------------------------------------------
   Filtros y enlaces
--------------------------------------------------------------------------- */

/** Entero de 1 a 365 (días); `null` si no lo es. */
export function parseDays(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= 365 ? value : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrUndefined = (raw: unknown) => (typeof raw === "string" && UUID.test(raw.trim()) ? raw.trim() : undefined);
const isTrue = (raw: unknown) => raw === true || raw === "true";

/** Filtros válidos de un objeto suelto (la URL o los `params` de la acción de una alerta). Lo inválido se ignora. */
export function suggestedFiltersFrom(raw: Record<string, unknown> | null | undefined): SuggestedPurchaseFilters {
  const source = raw ?? {};
  const filters: SuggestedPurchaseFilters = {};
  const inventoryId = uuidOrUndefined(source.inventoryId);
  if (inventoryId) filters.inventoryId = inventoryId;
  const days = parseDays(source.days);
  if (days) filters.days = days;
  const targetDays = parseDays(source.targetDays);
  if (targetDays) filters.targetDays = targetDays;
  const supplierId = uuidOrUndefined(source.supplierId);
  if (supplierId) filters.supplierId = supplierId;
  if (isTrue(source.includeWithoutSales)) filters.includeWithoutSales = true;
  return filters;
}

/** `/compras/sugerido?…` con los filtros (el atajo de la alerta «Bajo mínimo» y los enlaces internos). */
export function suggestedPurchaseHref(raw?: Record<string, unknown> | null): string {
  const filters = suggestedFiltersFrom(raw);
  const params = new URLSearchParams();
  if (filters.inventoryId) params.set("inventoryId", filters.inventoryId);
  if (filters.days) params.set("days", String(filters.days));
  if (filters.targetDays) params.set("targetDays", String(filters.targetDays));
  if (filters.supplierId) params.set("supplierId", filters.supplierId);
  if (filters.includeWithoutSales) params.set("includeWithoutSales", "true");
  const query = params.toString();
  return query ? `${SUGGESTED_PURCHASE_PATH}?${query}` : SUGGESTED_PURCHASE_PATH;
}

/** Enlace a una OC: abre su detalle en Compras › Órdenes de compra. */
export const purchaseOrderHref = (orderId: string) => `/compras?oc=${encodeURIComponent(orderId)}`;

/* ---------------------------------------------------------------------------
   Textos
--------------------------------------------------------------------------- */

const DECIMALS = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

/** Venta diaria con hasta 2 decimales («1.5»). */
export const formatVd = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : DECIMALS.format(Number(value));

/** «12 días», «1 día» o «—» (sin ventas en la ventana). */
export function coverageText(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return "—";
  return Number(days) === 1 ? "1 día" : `${Number(days).toLocaleString("es-PE")} días`;
}

export type CoverageTone = "none" | "out" | "low" | "ok";

/** Color de la cobertura: sin ventas, agotado (0), bajo los días objetivo o bien. */
export function coverageTone(days: number | null | undefined, targetDays: number): CoverageTone {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return "none";
  if (Number(days) <= 0) return "out";
  return Number(days) < targetDays ? "low" : "ok";
}

export const COVERAGE_TONE_CLASS: Record<CoverageTone, string> = {
  none: "text-muted-foreground",
  out: "font-semibold text-destructive",
  low: "font-semibold text-amber-700 dark:text-amber-400",
  ok: "",
};

/** «Polo · Talla: M» */
export const itemLabel = (item: Pick<SuggestedPurchaseItem, "productName" | "attributes">): string =>
  [item.productName || "Producto sin nombre", formatVariantLabel(item.attributes)].filter(Boolean).join(" · ");

/** «Caja × 12» o «und». */
export const purchaseUnitLabel = (item: Pick<SuggestedPurchaseItem, "purchaseUnit" | "purchaseFactor">): string =>
  item.purchaseFactor > 1 ? `${item.purchaseUnit || "Caja"} × ${item.purchaseFactor}` : "und";

/* ---------------------------------------------------------------------------
   Edición (cantidades en unidades de compra y casilla por línea)
--------------------------------------------------------------------------- */

export interface LineEdit {
  /** Cantidad en unidades de compra, como se tipea. */
  quantity?: string;
  selected?: boolean;
}
export type LineEdits = Record<string, LineEdit>;
/** Proveedor elegido por grupo (clave del grupo → id del proveedor; "" = sin elegir). */
export type GroupSuppliers = Record<string, string>;

export const groupKeyOf = (group: Pick<SuggestedPurchaseGroup, "supplierId">): string => group.supplierId ?? NO_SUPPLIER;

/** Lo que muestra la línea: lo editado o, si no, lo sugerido (marcada si hay algo que pedir). */
export function lineState(item: SuggestedPurchaseItem, edits: LineEdits): { quantity: string; selected: boolean } {
  const edit = edits[item.variantId] ?? {};
  return {
    quantity: edit.quantity ?? String(item.purchaseQuantity),
    selected: edit.selected ?? item.purchaseQuantity > 0,
  };
}

/** Unidades de compra tipeadas; `null` si no es un entero ≥ 0. */
export function parsePurchaseQuantity(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

/** Unidades de stock de la línea (cajas × factor); `null` si la cantidad no es válida. */
export function lineUnits(item: Pick<SuggestedPurchaseItem, "purchaseFactor">, quantity: string): number | null {
  const parsed = parsePurchaseQuantity(quantity);
  return parsed === null ? null : parsed * Math.max(1, item.purchaseFactor || 1);
}

/** Por qué la cantidad no sirve; `null` si está bien. */
export function lineProblem(item: Pick<SuggestedPurchaseItem, "purchaseFactor">, quantity: string): string | null {
  const units = lineUnits(item, quantity);
  if (units === null) return "Escribe un número entero.";
  if (units > MAX_SUGGESTED_UNITS) return `Hasta ${MAX_SUGGESTED_UNITS.toLocaleString("es-PE")} unidades por producto.`;
  return null;
}

/**
 * Monto estimado de la línea = unidades × último costo. `undefined` = el rol no ve costos (la API omitió la
 * clave); `null` = nunca se compró (sin costo).
 */
export function lineAmount(item: SuggestedPurchaseItem, units: number | null): number | null | undefined {
  if (!("lastUnitCost" in item)) return undefined;
  if (item.lastUnitCost === null || item.lastUnitCost === undefined || units === null) return null;
  return roundTo(units * item.lastUnitCost, 2);
}

/** A quién se le compra el grupo: lo elegido o su último proveedor si sigue activo. */
export function groupSupplierOf(group: SuggestedPurchaseGroup, suppliers: GroupSuppliers): string {
  const key = groupKeyOf(group);
  if (key in suppliers) return suppliers[key];
  return group.supplierId && group.supplierActive !== false ? group.supplierId : "";
}

export interface GroupSelection {
  products: number;
  units: number;
  /** `undefined` = el rol no ve costos. */
  amount: number | undefined;
}

/** Lo marcado de un grupo (líneas con cantidad > 0 y válida). */
export function groupSelection(group: SuggestedPurchaseGroup, edits: LineEdits): GroupSelection {
  let products = 0;
  let units = 0;
  let amount = 0;
  let masked = false;
  for (const item of group.items) {
    const state = lineState(item, edits);
    const lineQty = lineUnits(item, state.quantity);
    if (!state.selected || !lineQty || lineProblem(item, state.quantity)) continue;
    products += 1;
    units += lineQty;
    const value = lineAmount(item, lineQty);
    if (value === undefined) masked = true;
    else if (value !== null) amount += value;
  }
  return { products, units, amount: masked ? undefined : roundTo(amount, 2) };
}

export interface GenerateSelection {
  lines: GenerateSuggestedLine[];
  /** Órdenes que se van a crear (una por proveedor). */
  orders: number;
  products: number;
  units: number;
  /** Monto estimado sin IGV; `undefined` = el rol no ve costos. */
  amount: number | undefined;
  /** Qué falta para generar (`null` = se puede). */
  problem: string | null;
}

/**
 * Cuerpo de «Generar órdenes de compra»: las líneas marcadas con cantidad > 0, cada una con el proveedor de su
 * grupo y las unidades de STOCK (cajas × factor). Sin `unitCost`: el servidor usa el último costo comprado.
 */
export function generateSelection(data: SuggestedPurchase | undefined, edits: LineEdits, suppliers: GroupSuppliers): GenerateSelection {
  const lines: GenerateSuggestedLine[] = [];
  const perSupplier = new Map<string, number>();
  let units = 0;
  let amount = 0;
  let masked = false;
  let problem: string | null = null;
  for (const group of data?.groups ?? []) {
    const supplierId = groupSupplierOf(group, suppliers);
    for (const item of group.items) {
      const state = lineState(item, edits);
      if (!state.selected) continue;
      const itemProblem = lineProblem(item, state.quantity);
      if (itemProblem) {
        problem ??= `${itemLabel(item)}: ${itemProblem}`;
        continue;
      }
      const quantity = lineUnits(item, state.quantity) ?? 0;
      if (quantity <= 0) continue;
      if (!supplierId) {
        problem ??= `Elige a quién comprarle ${group.supplierName ? `en lugar de ${group.supplierName} (inactivo)` : "los productos sin proveedor"} o desmárcalos.`;
        continue;
      }
      lines.push({ variantId: item.variantId, quantity, supplierId });
      perSupplier.set(supplierId, (perSupplier.get(supplierId) ?? 0) + 1);
      units += quantity;
      const value = lineAmount(item, quantity);
      if (value === undefined) masked = true;
      else if (value !== null) amount += value;
    }
  }
  if (!problem && lines.length === 0) problem = "Marca al menos un producto con cantidad mayor a 0.";
  if (!problem && lines.length > MAX_GENERATE_LINES) problem = `Puedes generar hasta ${MAX_GENERATE_LINES} productos a la vez.`;
  if (!problem && [...perSupplier.values()].some((count) => count > MAX_LINES_PER_SUPPLIER))
    problem = `Una orden de compra tiene hasta ${MAX_LINES_PER_SUPPLIER} productos: desmarca algunos de ese proveedor.`;
  return { lines, orders: perSupplier.size, products: lines.length, units, amount: masked ? undefined : roundTo(amount, 2), problem };
}
