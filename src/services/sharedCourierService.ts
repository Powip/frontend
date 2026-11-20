import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs } from "@/lib/idempotency";

// FEAT-24 H8 — courier compartido: almacenes courier, stock Powip contra el
// courier, conciliaciones de unidades y reclamos al courier. Todo va por la
// fachada autenticada de ms-products (`src/courier/`), que toma la empresa, el
// usuario y el ROL del token: este servicio nunca envía un companyId ni un userId.
//
// Costo por rol: a quien no ve costos la fachada le OMITE `unitCost`, `value`,
// `unexplainedValue`, `shortageValue`, `amount`, `totalAmount`,
// `collectedAmount` y `storageCostMonth` (no los manda en 0). Por eso son
// opcionales: si la clave no está, la pantalla muestra «••••».
//
// Roles (la fachada responde 403 a lo demás): ver = Administrador, Operaciones,
// Almacén y COURIER (este solo su almacén, sin montos ni reclamos); conciliar,
// el mapa de Aliclik y los reclamos = Administrador y Operaciones.

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;
const id = (value: string) => encodeURIComponent(value);

/** Las escrituras de la fachada tienen 60 s de timeout hacia logistics. */
const WRITE_TIMEOUT_MS = 65_000;

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export type CourierProvider = "aliclik" | "eva" | "shalom" | "olva" | "otro";
export type CourierSyncMode = "api" | "portal" | "manual";

/* ---------------------------------------------------------------------------
   Almacenes courier
--------------------------------------------------------------------------- */

export interface CourierWarehouse {
  id: string;
  name: string;
  active: boolean;
  courierProvider: CourierProvider | null;
  syncMode: CourierSyncMode | null;
  /** Gasto logístico mensual; sin rol de costos no viene. */
  storageCostMonth?: number | null;
  physical: number;
  reserved: number;
  incomingTransfer: number;
  pendingReturn: number;
  value?: number | null;
  withoutCost: number;
  openReconciliation: { id: string; number: string; createdAt: string; unexplainedLines: number } | null;
  /** Abiertos + aceptados. No viene para el rol COURIER. */
  openClaims?: { count: number; units: number; amount?: number | null };
}

export async function listCourierWarehouses(signal?: AbortSignal): Promise<CourierWarehouse[]> {
  const { data } = await axiosAuth.get<{ items?: CourierWarehouse[] }>(`${products()}/courier-warehouses`, { signal });
  return list<CourierWarehouse>(data?.items);
}

/* ---------------------------------------------------------------------------
   Mapa de almacenes de Aliclik (Administrador u Operaciones)
--------------------------------------------------------------------------- */

export interface AliclikWarehouseMapItem {
  aliclikWarehouseId: number;
  warehouseName: string | null;
  /** Almacén de Powip al que apunta (o null). */
  inventoryId: string | null;
  mappedHere: boolean;
  skus: number;
  linkedSkus: number;
  units: number;
  lastSyncedAt: string | null;
}

export interface AliclikWarehouseMap {
  inventoryId: string | null;
  items: AliclikWarehouseMapItem[];
}

export async function getAliclikMap(inventoryId: string, signal?: AbortSignal): Promise<AliclikWarehouseMap> {
  const { data } = await axiosAuth.get<AliclikWarehouseMap>(`${products()}/courier-warehouses/${id(inventoryId)}/aliclik-map`, { signal });
  return { inventoryId: data?.inventoryId ?? inventoryId, items: list<AliclikWarehouseMapItem>(data?.items) };
}

/** REEMPLAZA los almacenes de Aliclik de este almacén ([] = ninguno). 409 `ALICLIK_WAREHOUSE_TAKEN` si uno ya es de otro. */
export async function saveAliclikMap(inventoryId: string, aliclikWarehouseIds: number[]): Promise<AliclikWarehouseMap> {
  const { data } = await axiosAuth.put<AliclikWarehouseMap>(`${products()}/courier-warehouses/${id(inventoryId)}/aliclik-map`, { aliclikWarehouseIds });
  return { inventoryId: data?.inventoryId ?? inventoryId, items: list<AliclikWarehouseMapItem>(data?.items) };
}

/* ---------------------------------------------------------------------------
   Stock del courier (Powip contra courier)
--------------------------------------------------------------------------- */

export type CourierStockSide =
  | {
      source: "api";
      available: true;
      mapped: boolean;
      aliclikWarehouses: Array<{ aliclikWarehouseId: number; warehouseName: string | null }>;
      lastSyncedAt: string | null;
      /** Sin sincronizar en 30 min (o nunca). */
      stale: boolean;
      unlinked: { skus: number; units: number };
    }
  | { source: "api"; available: false; message?: string }
  | { source: "conteo"; available: true; countId: string; countNumber: string; countStatus: string; countedAt: string | null }
  | { source: null; available: false };

export interface CourierStockItem {
  variantId: string;
  trackingMode: string | null;
  physical: number;
  reserved: number;
  available: number;
  inTransit: number;
  pendingReturn: number;
  incomingTransfer: number;
  unitCost?: number | null;
  value?: number | null;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  companySku: string | null;
  attributes: Record<string, string>;
  /** Lo que reporta el courier (null si no se sabe). */
  courier: number | null;
  /** courier − disponible (api) o courier − físico (conteo). */
  difference: number | null;
}

export interface CourierStock {
  warehouse: {
    id: string;
    name: string;
    active: boolean;
    courierProvider: CourierProvider | null;
    syncMode: CourierSyncMode | null;
    storageCostMonth?: number | null;
  };
  basis: "disponible" | "fisico";
  courier: CourierStockSide;
  items: CourierStockItem[];
  totals: {
    variants: number;
    physical: number;
    reserved: number;
    available: number;
    incomingTransfer: number;
    pendingReturn: number;
    value?: number | null;
    withoutCost: number;
  };
  lastCount: { id: string; number: string; status: string; closedAt: string | null; appliedAt: string | null } | null;
  openReconciliation: { id: string; number: string; createdAt: string } | null;
}

export async function getCourierStock(inventoryId: string, signal?: AbortSignal): Promise<CourierStock> {
  const { data } = await axiosAuth.get<CourierStock>(`${products()}/courier-stock/${id(inventoryId)}`, { signal });
  return { ...data, items: list<CourierStockItem>(data?.items), courier: data?.courier ?? { source: null, available: false } };
}

/* ---------------------------------------------------------------------------
   Conciliaciones (CON-0001)
--------------------------------------------------------------------------- */

export type ReconciliationStatus = "abierta" | "cerrada" | "anulada";
export type ReconciliationSource = "api" | "conteo";
export type ReconciliationBasis = "fisico" | "disponible";
export type AutoExplanationType = "traslado_en_camino" | "devolucion_por_recibir" | "merma_por_aprobar";
export type ManualExplanationType = "despacho_sin_pedido" | "merma_courier";

export interface ReconciliationSummary {
  lines: number;
  withDifference: number;
  unexplainedLines: number;
  shortageUnits: number;
  shortageValue?: number | null;
  shortageWithoutCost: number;
  surplusUnits: number;
  claimedUnits: number;
  balanced: boolean;
}

export interface ReconciliationExplanation {
  id: string;
  type: AutoExplanationType | ManualExplanationType | string;
  source: "auto" | "manual";
  /** Con signo: + explica que el courier tenga MÁS; − que tenga MENOS. */
  quantity: number;
  /** Lo que cuenta de verdad (solo las del sentido de la diferencia, hasta lo que queda). */
  applied: number;
  references?: Array<{ id: string; number: string }>;
  note?: string | null;
  reference?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  userEmail?: string | null;
}

export interface ReconciliationLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  powipBase: number;
  baseAt: string | null;
  powip: number;
  powipReserved: number;
  courier: number;
  /** courier − powip. */
  difference: number;
  explanations: ReconciliationExplanation[];
  explained: number;
  /** Negativo = faltante reclamable. */
  unexplained: number;
  claimedQuantity: number;
  unitCost?: number | null;
  unexplainedValue?: number | null;
}

export interface ReconciliationClaimRef {
  id: string;
  number: string;
  status: CourierClaimStatus;
  totalUnits: number;
  totalAmount?: number | null;
}

export interface CourierReconciliation {
  id: string;
  number: string;
  inventoryId: string;
  courierProvider: CourierProvider | null;
  source: ReconciliationSource;
  basis: ReconciliationBasis;
  countId: string | null;
  countNumber: string | null;
  cutoffAt: string | null;
  courierReportedAt: string | null;
  status: ReconciliationStatus;
  notes: string | null;
  recalculatedAt: string | null;
  userEmail?: string | null;
  userName?: string | null;
  closedAt: string | null;
  closedByEmail?: string | null;
  closedByName?: string | null;
  closeNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt?: string;
  summary: ReconciliationSummary;
  claims?: ReconciliationClaimRef[];
  lines?: ReconciliationLine[];
  /** Solo al crear con la API: cómo estaba la lectura de Aliclik. */
  courierReading?: { lastSyncedAt: string | null; stale: boolean; unlinked: { skus: number; units: number } };
}

export async function listReconciliations(
  params: { status?: ReconciliationStatus; inventoryId?: string } = {},
  signal?: AbortSignal,
): Promise<CourierReconciliation[]> {
  const { data } = await axiosAuth.get<{ items?: CourierReconciliation[] }>(`${products()}/courier-reconciliations`, { params, signal });
  return list<CourierReconciliation>(data?.items);
}

export async function getReconciliation(reconciliationId: string, signal?: AbortSignal): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.get<CourierReconciliation>(`${products()}/courier-reconciliations/${id(reconciliationId)}`, { signal });
  return data;
}

export interface CreateReconciliationBody {
  inventoryId: string;
  source: ReconciliationSource;
  countId?: string;
  basis?: ReconciliationBasis;
  cutoffAt?: string;
  notes?: string;
}

export async function createReconciliation(body: CreateReconciliationBody): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.post<CourierReconciliation>(`${products()}/courier-reconciliations`, body, { timeout: WRITE_TIMEOUT_MS });
  return data;
}

/** `refreshCourier: true` (solo API) vuelve a leer Aliclik y rehace la foto conservando lo manual y lo reclamado. */
export async function recalculateReconciliation(reconciliationId: string, body: { refreshCourier?: boolean } = {}): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.post<CourierReconciliation>(`${products()}/courier-reconciliations/${id(reconciliationId)}/recalculate`, body, {
    timeout: WRITE_TIMEOUT_MS,
  });
  return data;
}

export interface ManualExplanationInput {
  type: ManualExplanationType;
  /** 1..10.000: unidades que explican que el courier tenga MENOS. */
  quantity: number;
  note?: string;
  reference?: string;
}

/** REEMPLAZA las explicaciones manuales de la línea. */
export async function setLineExplanations(reconciliationId: string, lineId: string, explanations: ManualExplanationInput[]): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.put<CourierReconciliation>(
    `${products()}/courier-reconciliations/${id(reconciliationId)}/lines/${id(lineId)}/explanations`,
    { explanations },
    { timeout: WRITE_TIMEOUT_MS },
  );
  return data;
}

export interface ClaimReconciliationBody {
  /** Sin líneas: todo el faltante sin explicar de todas las líneas. */
  lines?: Array<{ lineId: string; quantity?: number }>;
  notes?: string;
  /** Clave estable de la acción: reenviarla devuelve el mismo reclamo con `duplicate: true`. */
  operationId: string;
}

export interface ClaimReconciliationResult {
  claim: CourierClaim;
  reconciliation: CourierReconciliation;
  duplicate: boolean;
}

/** Baja el físico (AJUSTE_NEGATIVO) y crea el reclamo RCL. Lleva `operationId` en el cuerpo y, si está prendido, en `Idempotency-Key`. */
export async function claimReconciliation(reconciliationId: string, body: ClaimReconciliationBody): Promise<ClaimReconciliationResult> {
  const { data } = await axiosAuth.post<ClaimReconciliationResult>(
    `${products()}/courier-reconciliations/${id(reconciliationId)}/claim`,
    body,
    ...writeConfigArgs({ idempotencyKey: body.operationId, timeoutMs: WRITE_TIMEOUT_MS }),
  );
  return data;
}

/** Con alguna línea sin explicar la nota es obligatoria (400). */
export async function closeReconciliation(reconciliationId: string, body: { note?: string } = {}): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.post<CourierReconciliation>(`${products()}/courier-reconciliations/${id(reconciliationId)}/close`, body, {
    timeout: WRITE_TIMEOUT_MS,
  });
  return data;
}

/** Solo sin reclamos (409). */
export async function cancelReconciliation(reconciliationId: string, body: { reason?: string } = {}): Promise<CourierReconciliation> {
  const { data } = await axiosAuth.post<CourierReconciliation>(`${products()}/courier-reconciliations/${id(reconciliationId)}/cancel`, body, {
    timeout: WRITE_TIMEOUT_MS,
  });
  return data;
}

/* ---------------------------------------------------------------------------
   Reclamos al courier (RCL-0001; Administrador u Operaciones)
--------------------------------------------------------------------------- */

export type CourierClaimStatus = "abierto" | "aceptado" | "cobrado" | "rechazado";

export interface CourierClaimLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  quantity: number;
  unitCost?: number | null;
  amount?: number | null;
}

export interface CourierClaimHistory {
  id: string;
  fromStatus: CourierClaimStatus | null;
  toStatus: CourierClaimStatus;
  note: string | null;
  collectedAmount?: number | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
}

export interface CourierClaim {
  id: string;
  number: string;
  inventoryId: string;
  courierProvider: CourierProvider | null;
  origin: "conciliacion" | "conteo";
  referenceId: string | null;
  referenceNumber: string | null;
  status: CourierClaimStatus;
  totalUnits: number;
  totalAmount?: number | null;
  linesWithoutCost: number;
  collectedAmount?: number | null;
  notes: string | null;
  userEmail?: string | null;
  userName?: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  lines?: CourierClaimLine[];
  history?: CourierClaimHistory[];
}

export type CourierClaimTotals = Partial<Record<CourierClaimStatus, { count: number; units: number; amount?: number | null; collectedAmount?: number | null }>>;

export async function listCourierClaims(
  params: { status?: CourierClaimStatus; inventoryId?: string } = {},
  signal?: AbortSignal,
): Promise<{ items: CourierClaim[]; totals: CourierClaimTotals }> {
  const { data } = await axiosAuth.get<{ items?: CourierClaim[]; totals?: CourierClaimTotals }>(`${products()}/courier-claims`, { params, signal });
  return { items: list<CourierClaim>(data?.items), totals: data?.totals ?? {} };
}

export async function getCourierClaim(claimId: string, signal?: AbortSignal): Promise<CourierClaim> {
  const { data } = await axiosAuth.get<CourierClaim>(`${products()}/courier-claims/${id(claimId)}`, { signal });
  return data;
}

export interface ChangeClaimStatusBody {
  status: Exclude<CourierClaimStatus, "abierto">;
  note?: string;
  /** Solo con «cobrado» (por defecto, el monto del reclamo). */
  collectedAmount?: number;
}

/** abierto → aceptado | rechazado; aceptado → cobrado | rechazado. Rechazar NO devuelve stock. */
export async function changeCourierClaimStatus(claimId: string, body: ChangeClaimStatusBody): Promise<CourierClaim> {
  const { data } = await axiosAuth.post<CourierClaim>(`${products()}/courier-claims/${id(claimId)}/status`, body, { timeout: WRITE_TIMEOUT_MS });
  return data;
}
