/**
 * FEAT-24 H4 (H4-D11) — pestaña «Stock por almacén» de la ficha: físico, reservado, disponible y, si el
 * backend los manda, en tránsito y por recibir. Usa las posiciones de `/inventory-item/search`.
 */
import { formatVariantLabel } from "@/lib/variantAttributes";

export interface StockPositionLike {
  inventoryItemId: string;
  variantId: string;
  productId?: string;
  inventoryId: string;
  inventoryName: string;
  storeName?: string;
  physicalStock: number;
  availableStock: number;
  reservedStock?: number;
  attributes?: Record<string, string>;
  companySku?: string | null;
  sku?: string;
}

export interface FichaStockRow {
  inventoryItemId: string;
  variantId: string;
  variantLabel: string;
  sku: string;
  inventoryName: string;
  storeName?: string;
  physical: number;
  reserved: number;
  available: number;
  inTransit: number | null;
  incoming: number | null;
}

export interface FichaStockView {
  rows: FichaStockRow[];
  totals: { physical: number; reserved: number; available: number; inTransit: number; incoming: number };
  /** Solo se muestran las columnas que el backend informa. */
  showTransit: boolean;
  showIncoming: boolean;
}

/** Primer número informado entre los nombres posibles (camelCase del contrato o snake_case de la entidad). */
function optionalNumber(row: object, keys: string[]): number | null {
  for (const key of keys) {
    const value = (row as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

const TRANSIT_KEYS = ["inTransitStock", "inTransit", "in_transit_quantity"];
const INCOMING_KEYS = ["incomingStock", "pendingReceiptStock", "pendingReturnStock", "pending_return_quantity"];

export function buildFichaStock(
  positions: StockPositionLike[],
  productId: string,
  variants: Array<{ id: string; attributeValues?: Record<string, unknown> | null; companySku?: string | null; sku?: string }> = [],
): FichaStockView {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const order = new Map(variants.map((variant, index) => [variant.id, index]));
  const rows = positions
    .filter((position) => position.productId === productId || variantById.has(position.variantId))
    .map((position): FichaStockRow => {
      const variant = variantById.get(position.variantId);
      return {
        inventoryItemId: position.inventoryItemId,
        variantId: position.variantId,
        variantLabel: formatVariantLabel(variant?.attributeValues ?? position.attributes) || "Única",
        sku: variant?.companySku?.trim() || position.companySku?.trim() || variant?.sku || position.sku || "",
        inventoryName: position.inventoryName,
        storeName: position.storeName,
        physical: Number(position.physicalStock) || 0,
        reserved: Number(position.reservedStock ?? 0) || 0,
        available: Number(position.availableStock) || 0,
        inTransit: optionalNumber(position, TRANSIT_KEYS),
        incoming: optionalNumber(position, INCOMING_KEYS),
      };
    })
    .sort((a, b) => (order.get(a.variantId) ?? 1e9) - (order.get(b.variantId) ?? 1e9) || a.variantLabel.localeCompare(b.variantLabel, "es") || a.inventoryName.localeCompare(b.inventoryName, "es"));
  const totals = rows.reduce((sum, row) => ({
    physical: sum.physical + row.physical,
    reserved: sum.reserved + row.reserved,
    available: sum.available + row.available,
    inTransit: sum.inTransit + (row.inTransit ?? 0),
    incoming: sum.incoming + (row.incoming ?? 0),
  }), { physical: 0, reserved: 0, available: 0, inTransit: 0, incoming: 0 });
  return { rows, totals, showTransit: rows.some((row) => row.inTransit !== null), showIncoming: rows.some((row) => row.incoming !== null) };
}
