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
