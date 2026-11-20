import { labelCount, MAX_LABELS_PER_PRINT, type LabelLine } from "./types";

// FEAT-24 H7-D5 — de dónde salen las etiquetas del diálogo «Imprimir etiquetas».

/**
 * Productos elegidos (ficha o selección del listado), el catálogo entero (acotable por categoría propia o
 * marca) o lo recibido de una orden de compra (FEAT-24 H3: una recepción, o todo lo recibido si no viene).
 */
export type LabelsSource =
  | { kind: "products"; productIds: string[]; title?: string }
  | { kind: "catalog" }
  | { kind: "purchase_order"; purchaseOrderId: string; receiptId?: string; title?: string };

/** `fixed`: N por variante; `stock`: lo disponible en el almacén elegido. */
export type LabelsQuantityMode = "fixed" | "stock";

export interface LabelsCatalogFilter {
  /** Categoría propia de la empresa (FEAT-24 H4, `GET /catalog-categories`). */
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
  /** Recepción de la OC; sin ella, todo lo recibido de la OC. */
  receiptId?: string;
}

/** El pedido para el backend, o `null` si falta algo (el almacén con «según stock», o no hay productos). */
export function buildLabelsRequest(
  source: LabelsSource,
  mode: LabelsQuantityMode,
  options: { inventoryId?: string; filter?: LabelsCatalogFilter } = {},
): LabelsDataRequest | null {
  // Lo recibido de la OC: la cantidad la pone la recepción, no el modo.
  if (source.kind === "purchase_order") {
    if (!source.purchaseOrderId) return null;
    return {
      origin: "purchase_order",
      purchaseOrderId: source.purchaseOrderId,
      ...(source.receiptId ? { receiptId: source.receiptId } : {}),
    };
  }
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
  if (mode === "stock" && !options.inventoryId) return null;
  // Con almacén elegido (también en «1 de cada una», donde hace de filtro: ver mergeLabelLines), lo de ese almacén.
  if (options.inventoryId) return { origin: "stock", inventoryId: options.inventoryId, ...scope };
  return { origin: "products", ...scope };
}

/**
 * Lo agregado con el buscador de «Imprimir etiquetas»: un producto entero (`variantId: null`, elegido por
 * nombre o SKU) o una sola variante (código de barras o SKU de variante escaneado).
 */
export interface AddedLabelItem {
  productId: string;
  variantId: string | null;
}

/** Pedido para traer lo agregado: con «según stock» el disponible del almacén; si no, 1 de cada una. */
export function buildAddedRequest(added: AddedLabelItem[], mode: LabelsQuantityMode, inventoryId: string): LabelsDataRequest | null {
  if (added.length === 0) return null;
  const ids = [...new Set(added.map((item) => item.productId))];
  if (mode === "stock") return inventoryId ? { origin: "stock", inventoryId, ids } : null;
  return { origin: "products", ids };
}

/**
 * La lista a imprimir: lo del origen (con `warehouseFilter` —almacén elegido y «1 de cada una»— solo lo que
 * hay en ese almacén, una etiqueta por variante), más lo agregado que no esté ya, menos lo quitado.
 */
export function mergeLabelLines({
  base,
  added = [],
  addedLines = [],
  removed = [],
  warehouseFilter = false,
}: {
  base: LabelLine[];
  added?: AddedLabelItem[];
  addedLines?: LabelLine[];
  removed?: string[];
  warehouseFilter?: boolean;
}): LabelLine[] {
  const fromSource = warehouseFilter ? base.filter((line) => line.quantity > 0).map((line) => ({ ...line, quantity: 1 })) : base;
  const wholeProducts = new Set(added.filter((item) => item.variantId === null).map((item) => item.productId));
  const singleVariants = new Set(added.flatMap((item) => (item.variantId ? [item.variantId] : [])));
  const seen = new Set(fromSource.map((line) => line.variantId));
  const extra = addedLines.filter((line) => {
    if (seen.has(line.variantId) || !(wholeProducts.has(line.productId) || singleVariants.has(line.variantId))) return false;
    seen.add(line.variantId);
    return true;
  });
  const hidden = new Set(removed);
  return [...fromSource, ...extra].filter((line) => !hidden.has(line.variantId));
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
