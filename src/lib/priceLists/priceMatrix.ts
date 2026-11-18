/**
 * FEAT-24 H9 (H9-D6) — matriz de precios por tienda: una columna por lista activa de la tienda (primero la
 * de todos los canales, después una por canal). Las listas guardan solo excepciones: una celda vacía hereda.
 * Cadena de la venta: lista de tienda+canal → lista de la tienda → `priceVta`.
 */
import type { PriceItemWrite, PriceList, PriceListItemsPage } from "@/services/priceListsService";

export interface PriceCell {
  price: number | null;
  compareAtPrice: number | null;
  inList: boolean;
}

export interface PriceMatrixRow {
  variantId: string;
  productName: string;
  attributeValues: Record<string, string>;
  companySku: string | null;
  /** `priceVta` de la variante. */
  basePrice: number;
  cells: Record<string, PriceCell>;
}

export interface CellDraft {
  price: string;
  compareAtPrice: string;
}

/** Listas activas de una tienda: la de todos los canales primero, después por canal (alfabético). */
export function storeLists(lists: PriceList[], storeId: string): PriceList[] {
  return lists
    .filter((list) => list.active && !list.isDefault && list.storeId === storeId)
    .sort((a, b) => (a.channel ? 1 : 0) - (b.channel ? 1 : 0) || (a.channel ?? "").localeCompare(b.channel ?? ""));
}

/** Junta las páginas de cada lista (mismos filtros y orden del servidor) en filas por variante. */
export function mergePriceRows(pages: Array<{ listId: string; page: PriceListItemsPage | undefined }>): PriceMatrixRow[] {
  const rows = new Map<string, PriceMatrixRow>();
  for (const { listId, page } of pages) {
    for (const item of page?.data ?? []) {
      let row = rows.get(item.variantId);
      if (!row) {
        row = {
          variantId: item.variantId,
          productName: item.productName,
          attributeValues: item.attributeValues ?? {},
          companySku: item.companySku,
          basePrice: item.inheritedPrice,
          cells: {},
        };
        rows.set(item.variantId, row);
      }
      row.cells[listId] = { price: item.inList ? item.price : null, compareAtPrice: item.compareAtPrice, inList: item.inList };
    }
  }
  return [...rows.values()];
}

/** Lo que cobra una celda vacía: el precio de la lista de la tienda (si es de canal) o `priceVta`. */
export function inheritedPrice(row: PriceMatrixRow, lists: PriceList[], listId: string): number {
  const list = lists.find((item) => item.id === listId);
  if (list?.channel) {
    const storeList = lists.find((item) => !item.channel && item.storeId === list.storeId);
    const storePrice = storeList ? row.cells[storeList.id]?.price : null;
    if (storePrice !== null && storePrice !== undefined) return storePrice;
  }
  return row.basePrice;
}

const parseMoney = (text: string): number | null => {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN;
};

/**
 * Cambios por lista a partir de lo escrito en las celdas: precio vacío = vuelve a heredar (`null`), tachado
 * vacío = sin tachado. Solo se manda lo que cambió.
 */
export function buildPriceWrites(
  drafts: Record<string, Record<string, CellDraft>>,
  rows: PriceMatrixRow[],
): { writes: Map<string, PriceItemWrite[]>; errors: string[] } {
  const writes = new Map<string, PriceItemWrite[]>();
  const errors: string[] = [];
  const byId = new Map(rows.map((row) => [row.variantId, row]));
  for (const [listId, cells] of Object.entries(drafts)) {
    for (const [variantId, draft] of Object.entries(cells)) {
      const row = byId.get(variantId);
      const current = row?.cells[listId] ?? { price: null, compareAtPrice: null, inList: false };
      const price = parseMoney(draft.price);
      const compare = parseMoney(draft.compareAtPrice);
      const name = row?.productName ?? variantId;
      if (Number.isNaN(price) || (price !== null && price <= 0)) {
        errors.push(`${name}: el precio tiene que ser un número mayor que 0.`);
        continue;
      }
      if (Number.isNaN(compare) || (compare !== null && compare <= 0)) {
        errors.push(`${name}: el precio tachado tiene que ser un número mayor que 0.`);
        continue;
      }
      if (price === null && compare !== null) {
        errors.push(`${name}: para poner un precio tachado, escribe también el precio.`);
        continue;
      }
      if (price !== null && compare !== null && compare <= price) {
        errors.push(`${name}: el precio tachado tiene que ser mayor que el precio.`);
        continue;
      }
      const samePrice = price === (current.inList ? current.price : null);
      const sameCompare = compare === (current.inList ? current.compareAtPrice : null);
      if (samePrice && sameCompare) continue;
      const write: PriceItemWrite = price === null ? { variantId, price: null } : { variantId, price, compareAtPrice: compare };
      writes.set(listId, [...(writes.get(listId) ?? []), write]);
    }
  }
  return { writes, errors };
}

export const formatPrice = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : value.toFixed(2);
