import type { BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import type { BusinessInventory } from "@/services/inventoryCatalogService";
import type { PackView } from "@/services/packsService";

/** Estado de una variante en la pantalla de Stock (mockup vistainv.html). */
export type StockStatus = "agotado" | "bajo" | "normal";
export type StockStatusFilter = "all" | StockStatus;
export type StockMode = "producto" | "almacen";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  agotado: "Agotado",
  bajo: "Bajo mínimo",
  normal: "Normal",
};

export interface StockFilters {
  search: string;
  storeId: string; // "all" o el id de la tienda
  inventoryId: string; // "all" o el id del almacén
  status: StockStatusFilter;
}

/** Una variante con todas sus posiciones (una por almacén) dentro del filtro. */
export interface StockVariantRow {
  variantId: string;
  first: BusinessInventoryItem;
  positions: BusinessInventoryItem[];
  byInventory: Map<string, BusinessInventoryItem>;
  physical: number;
  reserved: number;
  available: number;
  minStock: number;
  status: StockStatus;
}

export interface StockProductGroup {
  key: string;
  productName: string;
  variants: StockVariantRow[];
}

export interface StockTotals {
  physical: number;
  reserved: number;
  available: number;
}

const reservedOf = (row: BusinessInventoryItem) => Number(row.reservedStock ?? 0) || 0;

export function stockStatus(available: number, minStock: number): StockStatus {
  if (available <= 0) return "agotado";
  if (available <= minStock) return "bajo";
  return "normal";
}

function matchesSearch(row: BusinessInventoryItem, query: string) {
  return !query || [row.productName, row.sku, row.companySku, ...Object.values(row.attributes ?? {})]
    .some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query));
}

/** Agrupa las posiciones por variante (nunca suma posiciones de variantes distintas, aunque compartan SKU). */
export function buildVariantRows(rows: BusinessInventoryItem[]): StockVariantRow[] {
  const byVariant = new Map<string, BusinessInventoryItem[]>();
  for (const row of rows) {
    const list = byVariant.get(row.variantId);
    if (list) list.push(row); else byVariant.set(row.variantId, [row]);
  }
  return [...byVariant.entries()].map(([variantId, positions]) => {
    const physical = positions.reduce((sum, row) => sum + row.physicalStock, 0);
    const reserved = positions.reduce((sum, row) => sum + reservedOf(row), 0);
    const available = positions.reduce((sum, row) => sum + row.availableStock, 0);
    const minStock = positions.reduce((sum, row) => sum + (Number(row.min_stock ?? 0) || 0), 0);
    return {
      variantId, first: positions[0], positions,
      byInventory: new Map(positions.map((row) => [row.inventoryId, row])),
      physical, reserved, available, minStock, status: stockStatus(available, minStock),
    };
  });
}

/** Filtra posiciones por tienda, almacén y texto; el estado se evalúa por variante sobre lo que quedó. */
export function filterStockVariants(rows: BusinessInventoryItem[], filters: StockFilters): StockVariantRow[] {
  const query = filters.search.trim().toLocaleLowerCase("es");
  const positions = rows.filter((row) =>
    (filters.storeId === "all" || row.storeId === filters.storeId) &&
    (filters.inventoryId === "all" || row.inventoryId === filters.inventoryId) &&
    matchesSearch(row, query));
  const variants = buildVariantRows(positions);
  return filters.status === "all" ? variants : variants.filter((variant) => variant.status === filters.status);
}

export function groupByProduct(variants: StockVariantRow[]): StockProductGroup[] {
  const groups = new Map<string, StockProductGroup>();
  for (const variant of variants) {
    const key = variant.first.productId || `nombre:${variant.first.productName}`;
    const group = groups.get(key);
    if (group) group.variants.push(variant);
    else groups.set(key, { key, productName: variant.first.productName, variants: [variant] });
  }
  return [...groups.values()];
}

export function stockTotals(variants: StockVariantRow[]): StockTotals {
  return variants.reduce((sum, variant) => ({
    physical: sum.physical + variant.physical,
    reserved: sum.reserved + variant.reserved,
    available: sum.available + variant.available,
  }), { physical: 0, reserved: 0, available: 0 });
}

/** Almacenes que se muestran como columnas o tarjetas, según los filtros de tienda y almacén. */
export function visibleInventories(inventories: BusinessInventory[], filters: Pick<StockFilters, "storeId" | "inventoryId">) {
  return inventories.filter((inv) =>
    (filters.storeId === "all" || inv.storeId === filters.storeId) &&
    (filters.inventoryId === "all" || inv.id === filters.inventoryId));
}

/** Tiendas dueñas de los almacenes del alcance, para el filtro «Tienda». */
export function storesOf(inventories: BusinessInventory[]) {
  const stores = new Map<string, string>();
  for (const inv of inventories) if (!stores.has(inv.storeId)) stores.set(inv.storeId, inv.storeName || "Tienda");
  return [...stores.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const variantPositionsFlat = (variants: StockVariantRow[]) => variants.flatMap((variant) => variant.positions);

/**
 * FEAT-24 H9: un pack al final de «Por producto», en cada almacén de «Por almacén» y en el Excel. No tiene
 * stock propio: su disponible es el de sus componentes.
 */
export interface PackStockRow {
  id: string;
  name: string;
  sku: string | null;
  /** Precio de venta del pack (`priceVta`). */
  price: number;
  /** Disponible por almacén visible; un almacén sin todos los componentes no figura. */
  byInventory: Map<string, number>;
  /** Suma de los almacenes visibles; `null` si ms-products no pudo calcularlo (logística caída). */
  total: number | null;
}

/**
 * Filas de packs para la tabla de Stock. ms-products ya calcula el disponible por almacén
 * (mín. de ⌊disponible del componente ÷ cantidad⌋); acá solo se queda con las columnas visibles, así el total
 * suma lo mismo que el de las variantes. Sin mínimo propio, un pack solo puede estar «Agotado» o «Normal».
 */
export function packStockRows(packs: PackView[], columns: BusinessInventory[], filters: StockFilters): PackStockRow[] {
  const query = filters.search.trim().toLocaleLowerCase("es");
  const rows: PackStockRow[] = [];
  for (const pack of packs) {
    if (!pack.active) continue;
    if (query && ![pack.name, pack.sku, pack.productSku].some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query))) continue;
    const byWarehouse = new Map((pack.available?.byWarehouse ?? []).map((entry) => [entry.inventoryId, Number(entry.available) || 0]));
    const byInventory = new Map(columns.flatMap((inv) => (byWarehouse.has(inv.id) ? [[inv.id, byWarehouse.get(inv.id)!] as const] : [])));
    // Sin datos (`available: null`) se muestra igual; con datos, solo si algún almacén visible tiene sus componentes.
    if (pack.available && byInventory.size === 0) continue;
    const total = pack.available ? [...byInventory.values()].reduce((sum, value) => sum + value, 0) : null;
    if (filters.status !== "all") {
      const status: StockStatus | null = total === null ? null : total <= 0 ? "agotado" : "normal";
      if (status !== filters.status) continue;
    }
    rows.push({ id: pack.id, name: pack.name, sku: pack.sku ?? pack.productSku, price: Number(pack.price) || 0, byInventory, total });
  }
  return rows;
}

/** Packs con disponible calculado en un almacén (para su tarjeta en «Por almacén»). */
export function packsInInventory(packs: PackStockRow[], inventoryId: string): Array<{ pack: PackStockRow; available: number }> {
  return packs.flatMap((pack) => (pack.byInventory.has(inventoryId) ? [{ pack, available: pack.byInventory.get(inventoryId)! }] : []));
}

/** Fila de la sección «Packs» del Excel de Stock (mismas columnas que las variantes; físico y reservado no aplican). */
export interface PackExcelRow {
  companySku: string;
  name: string;
  store: string;
  inventory: string;
  /** Disponible calculado o «Sin dato» si ms-products no pudo calcularlo. */
  available: number | "Sin dato";
  price: number;
}

/**
 * Sección «Packs» del Excel: una fila por pack y almacén visible (como las variantes), en el orden de las
 * columnas. Un pack sin datos (logística caída) sale una vez con «Sin dato».
 */
export function packExcelRows(packs: PackStockRow[], columns: BusinessInventory[]): PackExcelRow[] {
  return packs.flatMap((pack): PackExcelRow[] => {
    const base = { companySku: pack.sku ?? "", name: pack.name, price: pack.price };
    if (pack.total === null) return [{ ...base, store: "", inventory: "", available: "Sin dato" as const }];
    return columns.flatMap((inv) =>
      pack.byInventory.has(inv.id)
        ? [{ ...base, store: inv.storeName || inv.storeId, inventory: inv.name, available: pack.byInventory.get(inv.id)! }]
        : [],
    );
  });
}
