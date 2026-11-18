/**
 * FEAT-24 H4 — cuerpos de la ficha del producto (`PATCH /products/:id`, `PATCH /product-variant/:id`) y
 * lectura de los errores del servidor (409 SKU repetido, 400 validación).
 */
import axios from "axios";

export const PRODUCT_SKU_MAX = 50;
export const VARIANT_SKU_MAX = 60;
export const BARCODE_MAX = 64;
export const PURCHASE_UNIT_MAX = 30;
export const PURCHASE_FACTOR_MAX = 10000;

/** Misma clave que el índice único del servidor: `upper(trim(companySku))`. */
export const skuKey = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

const clean = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ");
const orNull = (value: string | null | undefined) => clean(value) || null;

/** SKU repetidos dentro del mismo formulario (antes de ir al servidor). Devuelve las claves repetidas. */
export function duplicateSkuKeys(values: Array<string | null | undefined>): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    const key = skuKey(value);
    if (!key) continue;
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }
  return repeated;
}

export interface ProductGeneralForm {
  name: string;
  description: string;
  companySku: string;
  brandId: string;
  categoryId: string;
  purchaseUnit: string;
  /** Texto del input: se valida como entero 1..10000. */
  purchaseFactor: string;
  imageUrl: string;
}

export type ProductPatch = Partial<{
  name: string;
  description: string;
  companySku: string | null;
  brandId: string | null;
  categoryId: string | null;
  purchaseUnit: string | null;
  purchaseFactor: number;
  imageUrl: string | null;
}>;

/** Solo los campos que cambiaron, ya normalizados; con errores no se manda nada. */
export function buildProductPatch(original: ProductGeneralForm, next: ProductGeneralForm): { patch: ProductPatch; errors: string[] } {
  const errors: string[] = [];
  const patch: ProductPatch = {};

  const name = clean(next.name);
  if (name.length < 3 || name.length > 100) errors.push("El nombre debe tener entre 3 y 100 caracteres.");
  else if (name !== clean(original.name)) patch.name = name;

  if ((next.description ?? "").trim() !== (original.description ?? "").trim()) patch.description = (next.description ?? "").trim();

  const sku = orNull(next.companySku);
  if (sku && sku.length > PRODUCT_SKU_MAX) errors.push(`El SKU base tiene más de ${PRODUCT_SKU_MAX} caracteres.`);
  else if (sku !== orNull(original.companySku)) patch.companySku = sku;

  if ((next.brandId || null) !== (original.brandId || null)) patch.brandId = next.brandId || null;
  if ((next.categoryId || null) !== (original.categoryId || null)) patch.categoryId = next.categoryId || null;

  const unit = orNull(next.purchaseUnit);
  if (unit && unit.length > PURCHASE_UNIT_MAX) errors.push(`La unidad de compra tiene más de ${PURCHASE_UNIT_MAX} caracteres.`);
  else if (unit !== orNull(original.purchaseUnit)) patch.purchaseUnit = unit;

  const factorText = clean(next.purchaseFactor) || "1";
  const factor = Number(factorText);
  if (!/^\d+$/.test(factorText) || !Number.isInteger(factor) || factor < 1 || factor > PURCHASE_FACTOR_MAX) {
    errors.push(`El factor de compra es un número entero entre 1 y ${PURCHASE_FACTOR_MAX.toLocaleString("en-US")}.`);
  } else if (factor !== (Number(clean(original.purchaseFactor)) || 1)) patch.purchaseFactor = factor;

  if (orNull(next.imageUrl) !== orNull(original.imageUrl)) patch.imageUrl = orNull(next.imageUrl);

  return errors.length ? { patch: {}, errors } : { patch, errors };
}

export interface VariantCodesForm {
  companySku: string;
  barcode: string;
}

export type VariantPatch = Partial<{ companySku: string | null; barcode: string | null; images: string[] }>;

/** SKU y código de barras de una variante: solo lo que cambió. */
export function buildVariantPatch(original: VariantCodesForm, next: VariantCodesForm): { patch: VariantPatch; errors: string[] } {
  const errors: string[] = [];
  const patch: VariantPatch = {};
  const sku = orNull(next.companySku);
  if (sku && sku.length > VARIANT_SKU_MAX) errors.push(`El SKU tiene más de ${VARIANT_SKU_MAX} caracteres.`);
  else if (sku !== orNull(original.companySku)) patch.companySku = sku;
  const barcode = (next.barcode ?? "").replace(/\s+/g, "") || null;
  if (barcode && barcode.length > BARCODE_MAX) errors.push(`El código de barras tiene más de ${BARCODE_MAX} caracteres.`);
  else if (barcode !== ((original.barcode ?? "").replace(/\s+/g, "") || null)) patch.barcode = barcode;
  return errors.length ? { patch: {}, errors } : { patch, errors };
}

export const isEmptyPatch = (patch: object) => Object.keys(patch).length === 0;

export interface ApiErrorInfo {
  status?: number;
  message: string;
  /** 409: el SKU (o el nombre) ya existe. */
  conflict: boolean;
}

/** Mensaje del servidor (Nest: `{ message: string | string[] }`) con su estado HTTP. */
export function apiErrorInfo(error: unknown, fallback: string): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const raw = (error.response?.data as { message?: unknown } | undefined)?.message;
    const message = Array.isArray(raw) ? raw.filter((item) => typeof item === "string").join(" ") : typeof raw === "string" ? raw : "";
    return { status, message: message || fallback, conflict: status === 409 };
  }
  if (error instanceof Error && error.message) return { message: error.message, conflict: false };
  return { message: fallback, conflict: false };
}
