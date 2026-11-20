import type { SupplierPrice } from "@/services/suggestedPurchaseService";

// FEAT-24 H13-D4 — precio de compra por proveedor (mockup v6 `precioProvHTML`):
// último, promedio, mínimo y fechas por variante × proveedor. Funciones puras.

/**
 * Proveedor con el último precio más bajo, para la etiqueta «Mejor precio». Solo si hay al menos dos
 * proveedores con costo (sin rol de costos la API los omite y no hay etiqueta).
 */
export function bestPriceSupplierId(rows: SupplierPrice[]): string | null {
  const priced = rows.filter((row) => typeof row.lastUnitCost === "number");
  if (priced.length < 2) return null;
  const best = priced.reduce((min, row) => ((row.lastUnitCost as number) < (min.lastUnitCost as number) ? row : min));
  return best.supplierId;
}

/** Filas de una variante, la de último precio más bajo primero (sin costo, al final, por fecha de compra). */
export function sortBySupplierPrice(rows: SupplierPrice[]): SupplierPrice[] {
  return [...rows].sort((a, b) => {
    const left = typeof a.lastUnitCost === "number" ? a.lastUnitCost : Number.POSITIVE_INFINITY;
    const right = typeof b.lastUnitCost === "number" ? b.lastUnitCost : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return (b.lastDate ?? "").localeCompare(a.lastDate ?? "");
  });
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Filtro por nombre o SKU (sin mayúsculas ni tildes). */
export function filterSupplierPrices(rows: SupplierPrice[], query: string): SupplierPrice[] {
  const needle = fold(query.trim());
  if (!needle) return rows;
  return rows.filter((row) => [row.productName ?? "", row.sku ?? ""].some((value) => fold(value).includes(needle)));
}
