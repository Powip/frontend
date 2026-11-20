/**
 * FEAT-24 H4 (H4-D2/D-Unificación) — SKU repetidos en cuarentena (`sku_conflict`). Al volver único el
 * SKU por empresa, el backfill dejó marcados los que chocaban: el comercio los renombra. No hay un
 * endpoint propio: salen de `GET /products/report`, que ya trae `skuConflict` del producto y de cada
 * variante. Lógica pura.
 */
import { formatVariantLabel } from "@/lib/variantAttributes";
import { isLiveVariant, type CatalogProductLike } from "./catalogProducts";

export interface SkuConflictRow {
  /** «product»: el SKU base del producto; «variant»: el SKU de una variante. */
  kind: "product" | "variant";
  /** id del producto o de la variante (lo que se renombra). */
  id: string;
  productId: string;
  productName: string;
  /** «SKU base» o las opciones de la variante (sin «Default Title»). */
  label: string;
  sku: string;
}

/** Filas a renombrar, por producto (nombre) y con el SKU base antes que sus variantes. */
export function skuConflictRows(products: CatalogProductLike[]): SkuConflictRow[] {
  const rows: SkuConflictRow[] = [];
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
  for (const product of sorted) {
    if (product.skuConflict) {
      rows.push({ kind: "product", id: product.id, productId: product.id, productName: product.name, label: "SKU base", sku: product.companySku?.trim() || "" });
    }
    for (const variant of product.variants ?? []) {
      if (!variant.skuConflict || !isLiveVariant(variant)) continue;
      rows.push({
        kind: "variant",
        id: variant.id,
        productId: product.id,
        productName: product.name,
        label: formatVariantLabel(variant.attributeValues) || "Única",
        sku: variant.companySku?.trim() || "",
      });
    }
  }
  return rows;
}
