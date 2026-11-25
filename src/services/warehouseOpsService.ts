import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs } from "@/lib/idempotency";
import type { CourierProvider, CourierSyncMode } from "./sharedCourierService";

// FEAT-24 H5-C — operación de almacén: traslados, ajustes y mermas, conteos,
// pendientes de investigación, ubicaciones y datos del almacén. Todo va por la
// fachada autenticada de ms-products (H5-B), que toma la empresa, el usuario y
// el rol del token: este servicio nunca envía un companyId ni un userId.
//
// Costo por rol: a quien no ve costos la fachada le OMITE `unitCost`, `value`,
// `lineValue`, `totalValue` y `differenceValue` (no los manda en 0). Por eso son
// opcionales: si la clave no está, la pantalla muestra «••••».
//
// Idempotencia (H6-B): las acciones que mueven stock llevan `operationId` (uuid)
// en el cuerpo y, si NEXT_PUBLIC_IDEMPOTENCY_HEADER=on, el MISMO valor en el
// header `Idempotency-Key` (la fachada da 400 si no coinciden). Reenviar el
// mismo `operationId` devuelve lo registrado con `duplicate: true`.

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;
const id = (value: string) => encodeURIComponent(value);

/** Timeout de las escrituras: sin él una petición colgada nunca se resuelve. */
const WRITE_TIMEOUT_MS = 30_000;

/** Config de axios de una acción que mueve stock: el header (si está prendido) es el `operationId` del cuerpo. */
function opArgs(operationId: string | undefined, timeoutMs = WRITE_TIMEOUT_MS) {
  return writeConfigArgs({ idempotencyKey: operationId, timeoutMs });
}

const items = <T>(data: unknown): T[] => {
  const list = (data as { items?: unknown } | null)?.items;
  return Array.isArray(list) ? (list as T[]) : [];
};

/* ---------------------------------------------------------------------------
   Traslados (TRA-0001, H5-D1/D2/D3)
--------------------------------------------------------------------------- */

export type TransferStatus = "borrador" | "en_camino" | "recibido" | "recibido_con_diferencia" | "anulado";
export type TransferDifferenceDecision = "pendiente" | "perdida" | "reclamo";

export interface TransferLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  quantitySent: number;
  /** `null` hasta que se recibe la línea. */
  quantityReceived: number | null;
  difference: number | null;
  /** pendiente | perdida | reclamo | sobrante (o `null`). */
  differenceDecision: string | null;
  /** Sin permiso de costos: no viene. */
  unitCost?: number | null;
  value?: number | null;
  investigationId?: string | null;
  receivedAt: string | null;
  /** FEAT-24 H5-L: lote elegido en el borrador (null = automático) y en qué lotes salió al despachar. */
  lotId?: string | null;
  lotNumber?: string | null;
  lotExpiresAt?: string | null;
  lots?: Array<{ lotId: string | null; lotNumber: string | null; quantity: number }> | null;
}

export interface Transfer {
  id: string;
  number: string;
  originInventoryId: string;
  destinationInventoryId: string;
  status: TransferStatus;
  /** Flete: gasto logístico informativo (no suma al costo). */
  freight: number | null;
  remissionGuide: string | null;
  notes: string | null;
  userEmail: string | null;
  userName: string | null;
  dispatchedAt: string | null;
  dispatchedByName?: string | null;
  dispatchedByEmail?: string | null;
  receivedAt: string | null;
  receivedByName?: string | null;
  receivedByEmail?: string | null;
  cancelledAt: string | null;
  cancelledByName?: string | null;
  cancelledByEmail?: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  totalSent: number;
  totalReceived: number;
  lines: TransferLine[];
}

export interface SaveTransferBody {
  originInventoryId: string;
  destinationInventoryId: string;
  /** FEAT-24 H5-L: `lotId` opcional (sin él sale primero el que vence antes). */
  lines: Array<{ variantId: string; quantity: number; lotId?: string }>;
  freight?: number;
  remissionGuide?: string;
  notes?: string;
}

export interface ReceiveTransferLineInput {
  /** Id de la línea del traslado. */
  itemId: string;
  quantityReceived: number;
  decision?: TransferDifferenceDecision;
  responsible?: string;
  dueDate?: string;
}

export interface ReceiveTransferBody {
  lines: ReceiveTransferLineInput[];
  operationId: string;
}

export interface TransferOperationResult {
  transfer: Transfer;
  duplicate: boolean;
}

const transfers = () => `${products()}/stock-transfers`;

export async function listTransfers(params: { status?: TransferStatus; inventoryId?: string } = {}, signal?: AbortSignal): Promise<Transfer[]> {
  const { data } = await axiosAuth.get(transfers(), { params, signal });
  return items<Transfer>(data);
}

export async function getTransfer(transferId: string): Promise<Transfer> {
  const { data } = await axiosAuth.get<Transfer>(`${transfers()}/${id(transferId)}`);
  return data;
}

export async function createTransfer(body: SaveTransferBody): Promise<Transfer> {
  const { data } = await axiosAuth.post<Transfer>(transfers(), body);
  return data;
}

/** Solo en borrador: reemplaza todo. */
export async function updateTransfer(transferId: string, body: SaveTransferBody): Promise<Transfer> {
  const { data } = await axiosAuth.put<Transfer>(`${transfers()}/${id(transferId)}`, body);
  return data;
}

/**
 * Despacha el borrador. FEAT-24 C-D3: `allowNegative: true` confirma que el físico del origen queda en negativo (solo
 * con control de stock flexible); se manda solo cuando es `true`. Sin él, 409 `STOCK_NEGATIVO_CONFIRMAR`.
 */
export async function dispatchTransfer(
  transferId: string,
  body: { operationId: string; allowNegative?: true },
  timeoutMs?: number,
): Promise<TransferOperationResult> {
  const { data } = await axiosAuth.post<TransferOperationResult>(`${transfers()}/${id(transferId)}/dispatch`, body, ...opArgs(body.operationId, timeoutMs));
  return data;
}

export async function receiveTransfer(transferId: string, body: ReceiveTransferBody, timeoutMs?: number): Promise<TransferOperationResult> {
  const { data } = await axiosAuth.post<TransferOperationResult>(`${transfers()}/${id(transferId)}/receive`, body, ...opArgs(body.operationId, timeoutMs));
  return data;
}

export async function cancelTransfer(transferId: string, body: { reason?: string; operationId: string }): Promise<TransferOperationResult> {
  const { data } = await axiosAuth.post<TransferOperationResult>(`${transfers()}/${id(transferId)}/cancel`, body, ...opArgs(body.operationId));
  return data;
}

/* ---------------------------------------------------------------------------
   Ajustes y mermas (AJ-0001, H5-D4)
--------------------------------------------------------------------------- */

export type AdjustmentKind = "ajuste" | "merma";
export type AdjustmentStatus = "pendiente_aprobacion" | "aplicado" | "rechazado" | "anulado";
export type AdjustmentReasonCode = "dano" | "vencimiento" | "robo" | "error_registro" | "muestra" | "otro";

export interface AdjustmentLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  /** Con signo: + entra, − sale. */
  quantityDelta: number;
  unitCost?: number | null;
  lineValue?: number | null;
  movementId: string | null;
  cancelMovementId: string | null;
}

export interface StockAdjustmentDoc {
  id: string;
  number: string;
  inventoryId: string;
  kind: AdjustmentKind;
  reason: AdjustmentReasonCode;
  note: string | null;
  photoUrl: string | null;
  status: AdjustmentStatus;
  totalUnits: number;
  totalValue?: number | null;
  userEmail: string | null;
  userName: string | null;
  approvedAt: string | null;
  approvedByName?: string | null;
  approvedByEmail?: string | null;
  rejectedAt: string | null;
  rejectedByName?: string | null;
  rejectedByEmail?: string | null;
  rejectReason: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  cancelledByName?: string | null;
  cancelledByEmail?: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: AdjustmentLine[];
}

export interface CreateAdjustmentBody {
  inventoryId: string;
  kind: AdjustmentKind;
  reason: AdjustmentReasonCode;
  note?: string;
  photoUrl?: string;
  /** FEAT-24 H5-L: `lotId` opcional (salida sin él: el que vence antes; entrada sin él: «sin lote»). */
  lines: Array<{ variantId: string; quantity: number; direction?: "IN" | "OUT"; lotId?: string }>;
  operationId: string;
  /**
   * FEAT-24 C-D3: confirma las salidas que dejan el físico en negativo (solo cuenta con control de stock flexible y si
   * el ajuste se aplica en el acto). Solo se manda cuando es `true`; sin él, 409 `STOCK_NEGATIVO_CONFIRMAR`.
   */
  allowNegative?: true;
}

export interface AdjustmentResult {
  adjustment: StockAdjustmentDoc;
  duplicate: boolean;
}

const adjustments = () => `${products()}/stock-adjustments`;

export async function listAdjustments(
  params: { status?: AdjustmentStatus; kind?: AdjustmentKind; inventoryId?: string } = {},
  signal?: AbortSignal,
): Promise<StockAdjustmentDoc[]> {
  const { data } = await axiosAuth.get(adjustments(), { params, signal });
  return items<StockAdjustmentDoc>(data);
}

export async function getAdjustment(adjustmentId: string): Promise<StockAdjustmentDoc> {
  const { data } = await axiosAuth.get<StockAdjustmentDoc>(`${adjustments()}/${id(adjustmentId)}`);
  return data;
}

/** Bajo el umbral se aplica al crear; sobre el umbral queda `pendiente_aprobacion`. */
export async function createAdjustment(body: CreateAdjustmentBody): Promise<AdjustmentResult> {
  const { data } = await axiosAuth.post<AdjustmentResult>(adjustments(), body, ...opArgs(body.operationId));
  return data;
}

/** Solo Administrador. */
export async function approveAdjustment(adjustmentId: string, body: { operationId: string }): Promise<AdjustmentResult> {
  const { data } = await axiosAuth.post<AdjustmentResult>(`${adjustments()}/${id(adjustmentId)}/approve`, body, ...opArgs(body.operationId));
  return data;
}

/** Solo Administrador. */
export async function rejectAdjustment(adjustmentId: string, body: { reason?: string; operationId: string }): Promise<AdjustmentResult> {
  const { data } = await axiosAuth.post<AdjustmentResult>(`${adjustments()}/${id(adjustmentId)}/reject`, body, ...opArgs(body.operationId));
  return data;
}

/** Pendiente: Administrador u Operaciones. Aplicado: solo Administrador (inversos). */
export async function cancelAdjustment(adjustmentId: string, body: { reason?: string; operationId: string }): Promise<AdjustmentResult> {
  const { data } = await axiosAuth.post<AdjustmentResult>(`${adjustments()}/${id(adjustmentId)}/cancel`, body, ...opArgs(body.operationId));
  return data;
}

/* ---------------------------------------------------------------------------
   Conteos (CT-0001, H5-D5)
--------------------------------------------------------------------------- */

export type CountStatus = "en_curso" | "por_validar" | "aplicado" | "anulado";
export type CountScope = "total" | "categoria" | "marca" | "ubicacion" | "seleccion";
export type CountDecision = "corregir_origen" | "perdida" | "sobrante" | "reclamo_courier" | "pendiente";

/**
 * Línea de un conteo. En un conteo ciego `en_curso` la fachada OMITE `systemInitial`, `movementsDuring`,
 * `expected`, `difference`, `differenceValue` y `withinTolerance`: la pantalla no los muestra ni los calcula.
 */
export interface CountLine {
  id: string;
  variantId: string;
  inventoryItemId?: string | null;
  sku: string | null;
  productName: string | null;
  systemInitial?: number | null;
  movementsDuring?: number | null;
  expected?: number | null;
  counted: number | null;
  firstCounted?: number | null;
  difference?: number | null;
  unitCost?: number | null;
  differenceValue?: number | null;
  withinTolerance?: boolean | null;
  /** `auto` = dentro de la tolerancia (lo decide el servidor al cerrar). */
  decision: CountDecision | "auto" | null;
  decisionNote?: string | null;
  responsible?: string | null;
  dueDate?: string | null;
  recountRequested?: boolean;
  countedAt?: string | null;
  countedByName?: string | null;
  countedByEmail?: string | null;
  movementId?: string | null;
  investigationId?: string | null;
}

export interface StockCount {
  id: string;
  number: string;
  inventoryId: string;
  scope: CountScope;
  scopeFilter: Record<string, unknown> | null;
  blind: boolean;
  status: CountStatus;
  notes: string | null;
  userEmail: string | null;
  userName: string | null;
  closedAt: string | null;
  appliedAt: string | null;
  appliedByName?: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  summary?: { lines: number; counted: number; withDifference?: number; pendingDecision?: number };
  /** Solo en el detalle. */
  lines?: CountLine[];
}

export interface CreateCountBody {
  inventoryId: string;
  scope: CountScope;
  categoryId?: string;
  brandId?: string;
  locationId?: string;
  variantIds?: string[];
  blind?: boolean;
  notes?: string;
}

export interface CountEntryInput {
  code?: string;
  variantId?: string;
  quantity: number;
}

export interface CountEntriesBody {
  /** `add` suma (lotes de escaneo); `set` reemplaza lo contado. */
  mode: "add" | "set";
  entries: CountEntryInput[];
  operationId: string;
}

export type UnresolvedReason = "no_encontrado" | "ambiguo" | "fuera_del_conteo";

export interface CountEntriesResult {
  countId: string;
  status: CountStatus;
  /** `expected` no viene en un conteo ciego abierto. */
  applied: Array<{ lineId: string; variantId: string; codes?: string[]; counted: number; expected?: number | null }>;
  unresolved: Array<{ code: string | null; variantId: string | null; quantity: number; reason: UnresolvedReason }>;
  duplicate: boolean;
}

export interface CountDecisionInput {
  lineId: string;
  decision: CountDecision;
  responsible?: string;
  dueDate?: string;
  note?: string;
}

const counts = () => `${products()}/stock-counts`;

export async function listCounts(params: { status?: CountStatus; inventoryId?: string } = {}, signal?: AbortSignal): Promise<StockCount[]> {
  const { data } = await axiosAuth.get(counts(), { params, signal });
  return items<StockCount>(data);
}

export async function getCount(countId: string, signal?: AbortSignal): Promise<StockCount> {
  const { data } = await axiosAuth.get<StockCount>(`${counts()}/${id(countId)}`, { signal });
  return data;
}

export async function createCount(body: CreateCountBody): Promise<StockCount> {
  const { data } = await axiosAuth.post<StockCount>(counts(), body);
  return data;
}

/** Lo contado: digitado (`set` con `variantId`) o escaneado (`add` con el código tal cual). */
export async function addCountEntries(countId: string, body: CountEntriesBody, timeoutMs?: number): Promise<CountEntriesResult> {
  const { data } = await axiosAuth.post<CountEntriesResult>(`${counts()}/${id(countId)}/entries`, body, ...opArgs(body.operationId, timeoutMs));
  return data;
}

export async function closeCount(countId: string): Promise<StockCount> {
  const { data } = await axiosAuth.post<StockCount>(`${counts()}/${id(countId)}/close`, {});
  return data;
}

export async function setCountDecisions(countId: string, lines: CountDecisionInput[]): Promise<StockCount> {
  const { data } = await axiosAuth.post<StockCount>(`${counts()}/${id(countId)}/decisions`, { lines });
  return data;
}

export async function recountLines(countId: string, lineIds: string[]): Promise<StockCount> {
  const { data } = await axiosAuth.post<StockCount>(`${counts()}/${id(countId)}/recount`, { lineIds });
  return data;
}

export async function applyCount(countId: string, body: { operationId: string }): Promise<{ count: StockCount; duplicate: boolean }> {
  const { data } = await axiosAuth.post<{ count: StockCount; duplicate: boolean }>(`${counts()}/${id(countId)}/apply`, body, ...opArgs(body.operationId));
  return data;
}

export async function cancelCount(countId: string, body: { reason?: string }): Promise<StockCount> {
  const { data } = await axiosAuth.post<StockCount>(`${counts()}/${id(countId)}/cancel`, body);
  return data;
}

/* ---------------------------------------------------------------------------
   Pendientes de investigación (H5-D6)
--------------------------------------------------------------------------- */

export type InvestigationStatus = "abierto" | "resuelto";
export type InvestigationResolution = "encontrado" | "perdida" | "reclamo" | "otro";

export interface Investigation {
  id: string;
  inventoryId: string;
  origin: "conteo" | "traslado" | "conciliacion";
  referenceId: string | null;
  referenceNumber: string | null;
  variantId: string;
  sku: string | null;
  productName: string | null;
  /** Con signo. */
  quantity: number;
  value?: number | null;
  responsible: string | null;
  dueDate: string | null;
  status: InvestigationStatus;
  resolution: InvestigationResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName?: string | null;
  createdAt: string;
}

const investigations = () => `${products()}/stock-investigations`;

export async function listInvestigations(params: { status?: InvestigationStatus; inventoryId?: string } = {}, signal?: AbortSignal): Promise<Investigation[]> {
  const { data } = await axiosAuth.get(investigations(), { params, signal });
  return items<Investigation>(data);
}

export async function updateInvestigation(investigationId: string, body: { responsible?: string; dueDate?: string }): Promise<Investigation> {
  const { data } = await axiosAuth.put<Investigation>(`${investigations()}/${id(investigationId)}`, body);
  return data;
}

export async function resolveInvestigation(investigationId: string, body: { resolution: InvestigationResolution; note?: string }): Promise<Investigation> {
  const { data } = await axiosAuth.post<Investigation>(`${investigations()}/${id(investigationId)}/resolve`, body);
  return data;
}

/* ---------------------------------------------------------------------------
   Ubicaciones (H5-D7) y datos del almacén (H5-D9)
--------------------------------------------------------------------------- */

export interface WarehouseLocation {
  id: string;
  inventoryId: string;
  code: string;
  description: string | null;
  active: boolean;
  assignedItems: number;
  createdAt: string;
  updatedAt: string;
}

const locations = () => `${products()}/warehouse-locations`;

export async function listLocations(inventoryId: string, signal?: AbortSignal): Promise<WarehouseLocation[]> {
  const { data } = await axiosAuth.get(locations(), { params: { inventoryId }, signal });
  return items<WarehouseLocation>(data);
}

export async function createLocation(body: { inventoryId: string; code: string; description?: string }): Promise<WarehouseLocation> {
  const { data } = await axiosAuth.post<WarehouseLocation>(locations(), body);
  return data;
}

export async function updateLocation(locationId: string, body: { code?: string; description?: string | null; active?: boolean }): Promise<WarehouseLocation> {
  const { data } = await axiosAuth.put<WarehouseLocation>(`${locations()}/${id(locationId)}`, body);
  return data;
}

/** 409 si tiene productos asignados. */
export async function deleteLocation(locationId: string): Promise<void> {
  await axiosAuth.delete(`${locations()}/${id(locationId)}`);
}

/** Ubicación principal de la variante en ese almacén (`null` la quita). */
export async function assignLocation(body: { inventoryId: string; variantId: string; locationId: string | null }): Promise<void> {
  await axiosAuth.put(`${locations()}/assign`, body);
}

export interface WarehouseDetails {
  id: string;
  storeId: string | null;
  name: string;
  type: string;
  isMain: boolean;
  active: boolean;
  code: string | null;
  ubigeo: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  sunatEstablishmentCode: string | null;
  // FEAT-24 H8-D1: datos del courier (solo en almacenes COURIER). Sin rol de costos `storageCostMonth` no viene.
  courierProvider?: CourierProvider | null;
  syncMode?: CourierSyncMode | null;
  storageCostMonth?: number | null;
  counters?: { physical: number; reserved: number; inTransit: number; pendingReturn: number; incomingTransfer: number };
}

export type WarehouseDetailsPatch = Partial<
  Record<"code" | "ubigeo" | "address" | "contactName" | "contactPhone" | "sunatEstablishmentCode", string | null>
> & {
  courierProvider?: CourierProvider | null;
  syncMode?: CourierSyncMode | null;
  storageCostMonth?: number | null;
};

const warehouses = () => `${products()}/warehouses`;

export async function getWarehouseDetails(inventoryId: string, signal?: AbortSignal): Promise<WarehouseDetails> {
  const { data } = await axiosAuth.get<WarehouseDetails>(`${warehouses()}/${id(inventoryId)}/details`, { signal });
  return data;
}

/** Lo que no llega queda; `null` lo borra. */
export async function updateWarehouseDetails(inventoryId: string, patch: WarehouseDetailsPatch): Promise<WarehouseDetails> {
  const { data } = await axiosAuth.put<WarehouseDetails>(`${warehouses()}/${id(inventoryId)}/details`, patch);
  return data;
}

/** 409 si es el principal o si físico, reservado, en tránsito, por recibir o en camino no están en 0. */
export async function setWarehouseActive(inventoryId: string, active: boolean): Promise<void> {
  await axiosAuth.post(`${warehouses()}/${id(inventoryId)}/${active ? "activate" : "deactivate"}`, {});
}

/* ---------------------------------------------------------------------------
   Quitar del almacén (FEAT-24 RMV)
--------------------------------------------------------------------------- */

/** Una variante o el producto entero (todas sus variantes en ese almacén). */
export type RemoveFromWarehouseTarget = { variantId: string } | { productId: string };

export interface RemoveFromWarehouseResult {
  inventoryId: string;
  /** Variantes que se quitaron ahora. */
  removed: Array<{ variantId: string; inventoryItemId: string }>;
  /** Ya estaban quitadas de este almacén (repetir no hace nada). */
  alreadyRemoved: string[];
  /** Del producto, pero sin fila en este almacén. */
  notInWarehouse: string[];
}

/**
 * Baja lógica: deja de verse en /inventario de ESE almacén; sigue en el catálogo, en los demás almacenes y en el
 * historial, y vuelve a aparecer cuando entra stock. Solo Administrador u Operaciones (403 al resto). 409
 * `QUITAR_DEL_ALMACEN_BLOQUEADO` con el motivo concreto en `message` si queda stock, reservas, un traslado en
 * camino, un ajuste o conteo pendiente o pedidos; con un producto es todo o nada.
 */
export async function removeFromWarehouse(inventoryId: string, target: RemoveFromWarehouseTarget): Promise<RemoveFromWarehouseResult> {
  const body = "variantId" in target ? { variantId: target.variantId } : { productId: target.productId };
  const { data } = await axiosAuth.post<RemoveFromWarehouseResult>(`${warehouses()}/${id(inventoryId)}/remove-items`, body, { timeout: WRITE_TIMEOUT_MS });
  return data;
}
