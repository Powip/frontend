import { formatVariantLabel } from "@/lib/variantAttributes";
import type { CatalogVariant } from "@/services/variantCodesService";
import type { ReturnReception } from "@/services/warehousesService";

// FEAT-24 H2-F — cómo se nombra cada cosa en Recepciones.

/** Número de pedido legible; sin él, el inicio del id. */
export function orderLabel(reception: Pick<ReturnReception, "orderNumber" | "orderId">): string {
  return reception.orderNumber?.trim() || `Pedido ${reception.orderId.slice(0, 8)}`;
}

export interface VariantText {
  /** Producto y variante, p. ej. «Polo · Talla: M». */
  name: string;
  /** SKU (y el de la empresa, si tiene). */
  detail: string;
}

export type VariantLabeler = (variantId: string) => VariantText;

export function makeVariantLabeler(variants: ReadonlyMap<string, CatalogVariant>): VariantLabeler {
  return (variantId) => {
    const variant = variants.get(variantId.toLowerCase());
    if (!variant) return { name: `Producto ${variantId.slice(0, 8)}`, detail: "No se encontró en el catálogo" };
    const attributes = formatVariantLabel(variant.attributeValues);
    const name = [variant.productName || "Producto sin nombre", attributes].filter(Boolean).join(" · ");
    const skus = [variant.companySku, variant.sku].filter((value, index, all) => value && all.indexOf(value) === index);
    return { name, detail: skus.length ? `SKU ${skus.join(" · ")}` : "" };
  };
}
