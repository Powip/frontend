import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  MergeStockMode,
  ReconciliationTaskItem,
  ReconciliationTaskType,
} from "@/services/reconciliationTask.service";

/**
 * FEAT-24 H11 — terminar la unificación (ms-products, rama `feat/feat24-h11`).
 * Todo va con el token del usuario (`axiosAuth`): la empresa sale SIEMPRE del
 * JWT, nunca se manda `companyId`.
 *
 * - `POST /unifications`: unión manual de dos variantes cualesquiera.
 * - `GET /reconciliation-tasks/sku-conflicts`: «Por unificar» con los SKU repetidos.
 * - `GET /reconciliation-tasks/history`: tareas confirmadas y rechazadas, sin «deshacer».
 */
const base = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export type UnificationStockMode = MergeStockMode;

export interface CreateUnificationInput {
  /** La variante que se une (deja de existir: queda unificada e inactiva). */
  originVariantId: string;
  /** La variante madre (se queda). */
  targetVariantId: string;
  stockMode: UnificationStockMode;
  /** Obligatoria con `count` (0 a 10.000) y prohibida con los otros modos. */
  countedQuantity?: number;
}

export interface UnificationVariantSnapshot {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  is_active: boolean | null;
}

export type UnificationVia = "bandeja" | "union_manual";
export type UnificationAction = "merge" | "link" | "confirm" | "reject";
export type UnificationHistoryStatus = "confirmed" | "rejected";

export interface UnificationHistoryItem {
  id: string;
  type: ReconciliationTaskType;
  status: UnificationHistoryStatus;
  via: UnificationVia;
  /** `null` solo si el backend no pudo deducirla (tarea vieja sin rastro). */
  action: UnificationAction | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: { user_id: string | null; email: string | null };
  winner: UnificationVariantSnapshot | null;
  losers: UnificationVariantSnapshot[];
  stock_mode: UnificationStockMode | null;
  counted_quantity: number | null;
  /** Costo que se fijó al unir (sensible: solo para quien ve costos). */
  price_base: number | null;
  /** Tarea anterior a H11: ganadora y perdedoras deducidas del catálogo, sin detalle guardado. */
  derived: boolean;
  items: ReconciliationTaskItem[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UnificationHistoryPage {
  data: UnificationHistoryItem[];
  meta: PageMeta;
}

export interface SkuConflictVariant {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  sku: string;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  image_url: string | null;
  price: number;
  /** Sensible: solo se muestra a quien ve costos (`canSeeProductCosts`). */
  cost: number;
  sku_conflict: boolean;
  tracking_mode: string;
  external_source: string | null;
  created_at: string;
}

export interface SkuConflictGroup {
  /** SKU normalizado como lo compara el índice único: `upper(trim(companySku))`. */
  sku_key: string;
  variants: SkuConflictVariant[];
}

export interface SkuConflictPage {
  data: SkuConflictGroup[];
  meta: PageMeta;
}

/** Unión manual (H11-D2). 201 con la fila del historial; el error del backend se muestra tal cual. */
export async function createUnification(input: CreateUnificationInput): Promise<UnificationHistoryItem> {
  const body: CreateUnificationInput = {
    originVariantId: input.originVariantId,
    targetVariantId: input.targetVariantId,
    stockMode: input.stockMode,
    ...(input.stockMode === "count" ? { countedQuantity: input.countedQuantity } : {}),
  };
  const { data } = await axiosAuth.post<UnificationHistoryItem>(`${base()}/unifications`, body);
  return data;
}

/** «Por unificar» con los SKU repetidos (`sku_conflict`), paginado por grupo. `q` solo con 2 a 100 caracteres. */
export async function listSkuConflictGroups(params: { page: number; limit?: number; q?: string }): Promise<SkuConflictPage> {
  const q = params.q?.trim() ?? "";
  const { data } = await axiosAuth.get<SkuConflictPage>(`${base()}/reconciliation-tasks/sku-conflicts`, {
    params: { page: params.page, limit: params.limit ?? 10, ...(q.length >= 2 ? { q: q.slice(0, 100) } : {}) },
  });
  return data;
}

/** Historial (H11-D5): confirmadas y rechazadas, la más reciente primero. */
export async function listUnificationHistory(params: {
  page: number;
  limit?: number;
  status?: UnificationHistoryStatus;
}): Promise<UnificationHistoryPage> {
  const { data } = await axiosAuth.get<UnificationHistoryPage>(`${base()}/reconciliation-tasks/history`, {
    params: { page: params.page, limit: params.limit ?? 10, ...(params.status ? { status: params.status } : {}) },
  });
  return data;
}

/**
 * Datos de una variante para la vista previa de la unión manual (foto, tipo, canal, IMEI/serie,
 * estado). El buscador seguro (`variant-search`) solo trae nombre, SKU y atributos, así que se
 * completa con `GET /product-variant/:id` (ya lo usan el cierre del día y los bundles). La ruta no
 * lleva JWT: se descarta si el producto no es de la empresa activa.
 */
export interface VariantPreview {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  product_type: string | null;
  sku: string | null;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  image_url: string | null;
  external_source: string | null;
  tracking_mode: string | null;
  is_active: boolean | null;
  merged_into: string | null;
  cost: number | null;
}

interface RawVariantResponse {
  id?: string;
  sku?: string | null;
  companySku?: string | null;
  attributeValues?: Record<string, string> | null;
  priceBase?: number | string | null;
  images?: string[] | null;
  isActive?: boolean;
  mergedInto?: string | null;
  product?: {
    id?: string;
    name?: string;
    companyId?: string;
    type?: string | null;
    imageUrl?: string | null;
    externalSource?: string | null;
    trackingMode?: string | null;
  } | null;
}

export async function getVariantPreview(variantId: string, companyId: string, signal?: AbortSignal): Promise<VariantPreview> {
  const { data } = await axiosAuth.get<RawVariantResponse>(`${base()}/product-variant/${encodeURIComponent(variantId)}`, { signal });
  if (!data?.id || !data.product) throw new Error("No se encontró la variante.");
  if (data.product.companyId !== companyId) throw new Error("La variante no pertenece al negocio activo.");
  const cost = data.priceBase === null || data.priceBase === undefined ? null : Number(data.priceBase);
  return {
    variant_id: data.id,
    product_id: data.product.id ?? null,
    product_name: data.product.name ?? "",
    product_type: data.product.type ?? null,
    sku: data.sku ?? null,
    company_sku: data.companySku ?? null,
    attribute_values: data.attributeValues ?? {},
    image_url: data.images?.[0] || data.product.imageUrl || null,
    external_source: data.product.externalSource ?? null,
    tracking_mode: data.product.trackingMode ?? null,
    is_active: typeof data.isActive === "boolean" ? data.isActive : null,
    merged_into: data.mergedInto ?? null,
    cost: Number.isFinite(cost) ? cost : null,
  };
}
