import { formatVariantLabel, isDefaultTitleValue } from "@/lib/variantAttributes";
import type {
  SkuConflictVariant,
  UnificationAction,
  UnificationStockMode,
  UnificationVia,
} from "@/services/unification.service";
import {
  parseCountedQuantity,
  validateMergeStock,
  type MergeStockSides,
  type MergeWarehouseRow,
} from "./mergeStockCost";

// FEAT-24 H11 — reglas de la unión manual y del historial, sin React para
// poder testearlas solas. El backend vuelve a validar todo: estos avisos solo
// adelantan lo que va a responder (y su mensaje se muestra igual, tal cual).

/** Variante elegida para la unión manual: lo mínimo del buscador seguro más lo que se sepa de su producto. */
export interface UnificationPick {
  variant_id: string;
  product_name: string;
  sku: string | null;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  // Lo que sigue falta cuando la variante sale del buscador (`variant-search`);
  // la vista previa lo completa con `getVariantPreview`.
  product_id?: string | null;
  product_type?: string | null;
  image_url?: string | null;
  external_source?: string | null;
  tracking_mode?: string | null;
  is_active?: boolean | null;
  merged_into?: string | null;
  cost?: number | null;
}

/** ¿Faltan datos del producto (foto, tipo, canal, IMEI/serie) para la vista previa? */
export const pickNeedsDetails = (pick: UnificationPick): boolean => pick.product_type === undefined;

/** «Unir a…» desde un grupo de SKU repetido: la fila ya trae todo (activa y sin unificar por definición). */
export function pickFromSkuConflict(variant: SkuConflictVariant): UnificationPick {
  return {
    variant_id: variant.variant_id,
    product_name: variant.product_name,
    sku: variant.sku,
    company_sku: variant.company_sku,
    attribute_values: variant.attribute_values ?? {},
    product_id: variant.product_id,
    product_type: variant.product_type ?? null,
    image_url: variant.image_url,
    external_source: variant.external_source,
    tracking_mode: variant.tracking_mode,
    is_active: true,
    merged_into: null,
    cost: variant.cost,
  };
}

const normalizeAttributeValue = (value: string) =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

/**
 * Misma firma que `attributeSignature` de ms-products: solo los valores (sin las
 * claves), normalizados (sin mayúsculas, tildes ni espacios de más), sin
 * «Default Title», ordenados. Dos variantes se pueden unir si su firma es igual.
 */
export function attributeSignature(attributeValues: Record<string, unknown> | null | undefined): string {
  return Object.values(attributeValues ?? {})
    .map((value) => normalizeAttributeValue(String(value ?? "")))
    .filter((value) => value.length > 0 && !isDefaultTitleValue(value))
    .sort()
    .join("|");
}

/** IMEI o serie (`trackingMode` distinto de NONE): no se unifica (H11-D6). */
export function isSerializedTracking(trackingMode: string | null | undefined): boolean {
  const mode = String(trackingMode ?? "").trim().toUpperCase();
  return mode !== "" && mode !== "NONE";
}

export const SERIALIZED_MESSAGE =
  "Los productos con IMEI o serie no se unifican: así se conserva la identidad y la trazabilidad de cada unidad.";

export const variantDisplayLabel = (attributeValues: Record<string, unknown> | null | undefined): string =>
  formatVariantLabel(attributeValues) || "Sin atributos";

/**
 * Avisos previos a la unión (no bloquean: el servidor decide y su mensaje se
 * muestra tal cual). Solo con los datos que hay: si todavía no se sabe el modo
 * de seguimiento o el estado, no se avisa de eso.
 */
export function unificationWarnings(origin: UnificationPick | null, target: UnificationPick | null): string[] {
  if (!origin || !target) return [];
  if (origin.variant_id === target.variant_id) {
    return ["Elegiste la misma variante en los dos lados: elige otra para unir."];
  }
  const warnings: string[] = [];
  if (attributeSignature(origin.attribute_values) !== attributeSignature(target.attribute_values)) {
    warnings.push(
      `Los atributos no coinciden (${variantDisplayLabel(target.attribute_values)} y ${variantDisplayLabel(origin.attribute_values)}): solo se unen variantes con la misma talla, color y demás opciones.`,
    );
  }
  for (const pick of [target, origin]) {
    if (isSerializedTracking(pick.tracking_mode)) {
      warnings.push(`«${pick.product_name}» tiene seguimiento por IMEI o serie. ${SERIALIZED_MESSAGE}`);
    }
  }
  for (const pick of [target, origin]) {
    if (pick.merged_into) warnings.push(`«${pick.product_name}» ya está unificada con otra variante.`);
  }
  if (target.is_active === false) {
    warnings.push("La variante madre está desactivada: actívala o elige otra.");
  }
  return warnings;
}

export interface UnificationStockCheck {
  /** Stock con el que queda la madre, si se puede calcular. */
  finalQuantity: number | null;
  /** Error para mostrar (no se muestra nada mientras falta elegir o escribir). */
  error: string | null;
  /** ¿Se puede pasar al paso siguiente? */
  valid: boolean;
}

/**
 * Valida el modo de stock. `count` exige una cantidad entera de 0 a 10.000 (y
 * con otro modo no se manda). Con el stock leído se aplican además las reglas
 * de la bandeja (tope por almacén, piso de reservas, conteo en un solo
 * almacén); sin él, solo el formato: el servidor valida el resto.
 */
export function validateUnificationStock(
  mode: UnificationStockMode | null,
  countedRaw: string,
  stock: { sides: MergeStockSides; rows: MergeWarehouseRow[] } | null,
): UnificationStockCheck {
  if (!mode) return { finalQuantity: null, error: null, valid: false };
  if (mode === "count") {
    if (countedRaw.trim() === "") return { finalQuantity: null, error: null, valid: false };
    if (parseCountedQuantity(countedRaw) === null) {
      return { finalQuantity: null, error: "Ingresa un número entero entre 0 y 10,000", valid: false };
    }
  }
  if (!stock) {
    return { finalQuantity: mode === "count" ? parseCountedQuantity(countedRaw) : null, error: null, valid: true };
  }
  const result = validateMergeStock(mode, stock.sides, countedRaw, stock.rows);
  return { ...result, valid: result.error === null && result.finalQuantity !== null };
}

export const STOCK_MODE_LABEL: Record<UnificationStockMode, string> = {
  winner: "Stock de la madre",
  sum: "Sumar ambos",
  count: "Conteo físico",
};

export const VIA_LABEL: Record<UnificationVia, string> = {
  bandeja: "Bandeja",
  union_manual: "Unión manual",
};

export const ACTION_LABEL: Record<UnificationAction, string> = {
  merge: "Unificación",
  link: "Vinculación",
  confirm: "Alta como nuevo",
  reject: "Rechazada",
};
