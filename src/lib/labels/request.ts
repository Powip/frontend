import { labelCount, MAX_LABELS_PER_PRINT, type LabelLine } from "./types";

// FEAT-24 H7-D5 — de dónde salen las etiquetas del diálogo «Imprimir etiquetas».

/** Productos elegidos (ficha o selección del listado) o el catálogo entero (acotable por categoría o marca). */
export type LabelsSource = { kind: "products"; productIds: string[]; title?: string } | { kind: "catalog" };

/** `fixed`: N por variante; `stock`: lo disponible en el almacén elegido. */
export type LabelsQuantityMode = "fixed" | "stock";

export interface LabelsCatalogFilter {
  categoryId?: string;
  brandId?: string;
}

/** Cuerpo de `POST /labels/data` (ms-products). */
export interface LabelsDataRequest {
  origin: "variants" | "products" | "stock" | "purchase_order";
  items?: Array<{ variantId: string; quantity: number }>;
  ids?: string[];
  inventoryId?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  quantity?: number;
  purchaseOrderId?: string;
}

/** El pedido para el backend, o `null` si falta algo (el almacén con «según stock», o no hay productos). */
export function buildLabelsRequest(
  source: LabelsSource,
  mode: LabelsQuantityMode,
  options: { inventoryId?: string; filter?: LabelsCatalogFilter } = {},
): LabelsDataRequest | null {
  const scope =
    source.kind === "products"
      ? source.productIds.length
        ? { ids: [...new Set(source.productIds)] }
        : null
      : {
          ...(options.filter?.categoryId ? { categoryId: options.filter.categoryId } : {}),
          ...(options.filter?.brandId ? { brandId: options.filter.brandId } : {}),
        };
  if (!scope) return null;
  if (mode === "stock") {
    if (!options.inventoryId) return null;
    return { origin: "stock", inventoryId: options.inventoryId, ...scope };
  }
  return { origin: "products", ...scope };
}

/** Cantidades finales: la del backend, o la que el usuario editó (entero ≥ 0). */
export function applyQuantities(lines: LabelLine[], overrides: Record<string, number>): LabelLine[] {
  return lines.map((line) =>
    overrides[line.variantId] === undefined ? line : { ...line, quantity: labelCount(overrides[line.variantId]) },
  );
}

/** Mensaje si no se puede imprimir, o `null`. */
export function printBlocker(lines: LabelLine[]): string | null {
  const total = lines.reduce((sum, line) => sum + labelCount(line.quantity), 0);
  if (total === 0) return "No hay etiquetas para imprimir.";
  if (total > MAX_LABELS_PER_PRINT) {
    return `Son ${total} etiquetas y el máximo por impresión es ${MAX_LABELS_PER_PRINT}. Baja las cantidades.`;
  }
  return null;
}
