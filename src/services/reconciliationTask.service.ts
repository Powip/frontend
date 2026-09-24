import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";

const API_PRODUCTS =
  process.env.NEXT_PUBLIC_API_PRODUCTOS || "http://localhost:3005";

const BASE_URL = `${API_PRODUCTS}/reconciliation-tasks`;

// FEAT-17 (Fase 5) — contrato exacto extraído de
// ms-products/src/reconciliationtask/entities/reconciliationtask.entity.ts y
// .../reconciliationtask.controller.ts. `companyId` nunca se manda como
// query param ni body: el backend siempre lo deriva del JWT (`user.companyId`
// en `CurrentUser`), mismo criterio ya aplicado en el resto del catálogo.
export type ReconciliationTaskType =
  | "provisional"
  | "manual"
  | "duplicate_cluster";

export type ReconciliationTaskStatus = "pending" | "confirmed" | "rejected";

export type ReconciliationTaskItemSource = "shopify" | "yavendio" | "aliclik";

// FEAT-17 Anexo A (sección 4) — coincidencia que generó la sugerencia: SKU
// exacto pesa más que nombre+atributos, que a su vez pesa más que sólo
// nombre. Ver ms-products `reconciliationtask.service.ts` (sync-on-read).
export type ReconciliationTaskSuggestionMatch =
  | "sku"
  | "name_attributes"
  | "name";

// Candidato ya existente en el catálogo que el backend sugiere para una
// provisional (calculado en `GET /reconciliation-tasks`, máx. 3, orden score
// desc). Nada se vincula automático: son sólo insumo para la UI de "¿Es la
// misma?" — la confirmación explícita siempre la hace el dueño.
export interface ReconciliationTaskSuggestion {
  variant_id: string;
  product_name: string;
  sku: string;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  match: ReconciliationTaskSuggestionMatch;
  score: number;
}

// Resultado de `GET /reconciliation-tasks/variant-search` — buscador seguro
// (JWT, `companyId` derivado del token) que reemplaza el pegado de UUID al
// vincular una provisional a mano.
export interface VariantSearchResult {
  variant_id: string;
  product_name: string;
  sku: string;
  company_sku: string | null;
  attribute_values: Record<string, string>;
}

export interface ReconciliationTaskItem {
  // `null` únicamente para `type: 'manual'` — no hay variante/producto real
  // contra el cual matchear.
  variant_id: string | null;
  product_id: string | null;
  variant_name: string;
  sku: string | null;
  company_sku: string | null;
  external_id: string | null;
  source: ReconciliationTaskItemSource | null;
  // 0 para 'provisional'/'manual' (alta nueva o ausencia de id externo),
  // 0.70-1.0 para 'duplicate_cluster' (D2: fuerza de la señal de matching).
  confidence: number;
  is_suggested_winner?: boolean;
  // Presentes SOLO para `type: 'manual'`.
  external_order_id?: string;
  external_line_ref?: string;
  // FEAT-17 Anexo A — sólo en items de tareas `type: 'provisional'`:
  // atributos de la línea externa que originó la provisional (p.ej.
  // `variant_title` de Shopify ya parseado). Puede faltar (fuentes o líneas
  // viejas que no los mandan) — nunca asumir que están presentes.
  attribute_values?: Record<string, string>;
  // FEAT-17 Anexo A — sólo en items de tareas `type: 'provisional'`
  // `status: 'pending'`: hasta 3 variantes candidatas para el bloque
  // "¿Es la misma?" de la bandeja.
  suggestions?: ReconciliationTaskSuggestion[];
}

export interface ReconciliationTask {
  id: string;
  companyId: string;
  type: ReconciliationTaskType;
  status: ReconciliationTaskStatus;
  // 1 item si type='provisional'|'manual'; 2+ si type='duplicate_cluster'.
  items: ReconciliationTaskItem[];
  confidenceLevel: number | null;
  dedupeKey: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkConfirmResultItem {
  task_id: string;
  status: "confirmed" | "skipped" | "error";
  message?: string;
}

export interface ListReconciliationTasksParams {
  type?: ReconciliationTaskType;
  status?: ReconciliationTaskStatus;
}

interface ReconciliationTaskApiErrorBody {
  message?: string | string[];
}

/**
 * Convierte cualquier error de estos endpoints (400/403/404/409) en un
 * mensaje listo para `toast.error`, priorizando el `message` que manda el
 * backend (class-validator o excepciones de negocio del service) y cayendo
 * a un fallback genérico si no viene o la request nunca llegó a responder.
 */
export function getReconciliationTaskErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError<ReconciliationTaskApiErrorBody>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message) && message.length > 0) {
      return message.join(", ");
    }
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export async function listReconciliationTasks(
  params?: ListReconciliationTasksParams,
): Promise<ReconciliationTask[]> {
  const res = await axiosAuth.get<ReconciliationTask[]>(BASE_URL, {
    params,
  });
  return res.data;
}

export async function getReconciliationTask(
  id: string,
): Promise<ReconciliationTask> {
  const res = await axiosAuth.get<ReconciliationTask>(`${BASE_URL}/${id}`);
  return res.data;
}

/**
 * Solo aplica a tareas `type: 'provisional'`: el dueño confirma que la
 * variante provisional de la tarea es en realidad `targetVariantId`
 * (variante ya existente en el catálogo).
 */
export async function resolveReconciliationLink(
  id: string,
  targetVariantId: string,
): Promise<ReconciliationTask> {
  const res = await axiosAuth.post<ReconciliationTask>(
    `${BASE_URL}/${id}/resolve-link`,
    { target_variant_id: targetVariantId },
  );
  return res.data;
}

/**
 * Solo aplica a tareas `type: 'duplicate_cluster'`. Ambos ids deben salir
 * de `task.items` — lo valida el backend (requiere cargar la tarea), no
 * este service.
 */
export async function resolveReconciliationMerge(
  id: string,
  winnerVariantId: string,
  loserVariantIds: string[],
): Promise<ReconciliationTask> {
  const res = await axiosAuth.post<ReconciliationTask>(
    `${BASE_URL}/${id}/resolve-merge`,
    {
      winner_variant_id: winnerVariantId,
      loser_variant_ids: loserVariantIds,
    },
  );
  return res.data;
}

/**
 * Solo aplica a tareas `type: 'provisional'`. Confirma que el provisional
 * es un producto nuevo genuino (no linkea a nada existente).
 */
export async function confirmReconciliationProvisional(
  id: string,
): Promise<ReconciliationTask> {
  const res = await axiosAuth.post<ReconciliationTask>(
    `${BASE_URL}/${id}/confirm-provisional`,
  );
  return res.data;
}

/**
 * Rechaza la tarea (spam / error de sync) — aplica a cualquier `type`.
 */
export async function rejectReconciliationTask(
  id: string,
): Promise<ReconciliationTask> {
  const res = await axiosAuth.post<ReconciliationTask>(
    `${BASE_URL}/${id}/resolve-reject`,
  );
  return res.data;
}

/**
 * Confirma varias tareas `pending` de una (máx 100 ids). Pensado para
 * clusters con ganadora ya sugerida por el backend
 * (`item.is_suggested_winner: true`) y provisionales que el dueño quiere
 * dar de alta en lote. Las tareas `type: 'manual'` siempre vuelven
 * `skipped` — el backend no tiene mecanismo de confirmación automática
 * para ellas.
 */
export async function bulkConfirmReconciliationTasks(
  taskIds: string[],
): Promise<BulkConfirmResultItem[]> {
  const res = await axiosAuth.post<BulkConfirmResultItem[]>(
    `${BASE_URL}/bulk-confirm`,
    { task_ids: taskIds },
  );
  return res.data;
}

/**
 * Buscador seguro de variantes existentes de la empresa (FEAT-17 Anexo A):
 * reemplaza el pegado de UUID al vincular una provisional. `companyId` lo
 * deriva el backend del JWT (nunca se manda acá, mismo criterio que el
 * resto del archivo). Mín. 2 caracteres; el backend limita a 20 resultados
 * y excluye provisionales pendientes y variantes ya fusionadas
 * (`merged_into`).
 */
export async function searchReconciliationVariants(
  q: string,
): Promise<VariantSearchResult[]> {
  const res = await axiosAuth.get<VariantSearchResult[]>(
    `${BASE_URL}/variant-search`,
    { params: { q } },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// FEAT-17 Anexo B — GET /reconciliation-tasks/:id/details: detalle
// enriquecido (producto, marca, categoría, variantes hermanas) de las
// candidatas de una tarea `type: 'duplicate_cluster'`, para el modal
// "Unificar" con detalle de producto. `companyId` siempre del JWT — una
// tarea de otra empresa devuelve 404 (no filtra existencia).
// ---------------------------------------------------------------------------

export interface ReconciliationTaskDetailBrand {
  id: string;
  name: string;
}

export interface ReconciliationTaskDetailCategory {
  id: string;
  name: string;
}

export interface ReconciliationTaskDetailVariant {
  id: string;
  sku: string | null;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  // Precio de venta y costo/base de `ProductVariant` — dos decimales.
  price: number;
  cost?: number | null;
  is_active: boolean;
  merged_into: string | null;
}

export interface ReconciliationTaskDetailProductVariant {
  id: string;
  sku: string | null;
  company_sku: string | null;
  attribute_values: Record<string, string>;
  price: number;
  is_active: boolean;
}

export interface ReconciliationTaskDetailProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  brand: ReconciliationTaskDetailBrand | null;
  category: ReconciliationTaskDetailCategory | null;
  subcategory: ReconciliationTaskDetailCategory | null;
  external_source: ReconciliationTaskItemSource | null;
  // Sólo variantes con `merged_into IS NULL` e `is_active: true`, más la
  // propia candidata aunque no cumpla ese filtro (spec Anexo B).
  variants: ReconciliationTaskDetailProductVariant[];
}

export interface ReconciliationTaskDetailCandidate {
  variant_id: string;
  is_suggested_winner: boolean;
  confidence: number;
  source: ReconciliationTaskItemSource | null;
  variant: ReconciliationTaskDetailVariant;
  product: ReconciliationTaskDetailProduct | null;
}

export interface ReconciliationTaskDetails {
  task_id: string;
  candidates: ReconciliationTaskDetailCandidate[];
}

/**
 * Detalle enriquecido de las candidatas de un cluster de duplicados, para
 * `ReconciliationMergeDialog` (FEAT-17 Anexo B). Si falla (404 de otra
 * empresa, error de red, endpoint todavía no desplegado), el diálogo cae a
 * la info básica de `task.items` — el merge se puede resolver igual.
 */
export async function getReconciliationTaskDetails(
  taskId: string,
): Promise<ReconciliationTaskDetails> {
  const res = await axiosAuth.get<ReconciliationTaskDetails>(
    `${BASE_URL}/${taskId}/details`,
  );
  return res.data;
}
