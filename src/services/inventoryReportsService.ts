import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H10 — reportes de inventario, kardex, alertas y cierre mensual. Todo va
// por la fachada autenticada de ms-products (`/inventory-reports` y
// `/period-closes`), que toma la empresa y el autor del token: este servicio
// nunca envía un companyId.
//
// Costo por rol (H10-D9): a quien no ve costos la fachada le OMITE las claves de
// costo y valor (`averageCost`, `value`, `totalValue`, `amount`, `unitCost`,
// `averageCostAfter`, `averageUnitCost`, `averageTicket`, `share`). Por eso son
// opcionales: si la clave no está, la pantalla muestra «••••» u oculta la columna.

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

/** Datos de catálogo que la fachada agrega a cada variante (`null` si la variante ya no está en el catálogo). */
export interface ReportCatalogInfo {
  productId: string | null;
  productName: string | null;
  sku: string | null;
  companySku: string | null;
  attributes: Record<string, string> | null;
  isActive?: boolean | null;
  mergedInto?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
}

/** «Sin historial antes del corte» (H10-D1): la fecha es anterior al libro de stock. */
export interface ReportUnavailable {
  available: false;
  reason: "sin_historial" | string;
  message: string;
  cutoffAt: string | null;
}

export type ReportSource = "live" | "close" | "ledger";

/* ---------------------------------------------------------------------------
   Stock a una fecha (Reporte general)
--------------------------------------------------------------------------- */

export interface ReportWarehouse {
  id: string;
  name: string;
  type?: string | null;
  isMain?: boolean;
  active?: boolean;
}

export interface StockReportCell {
  inventoryId: string;
  physical: number;
  reserved: number;
  available: number;
  /** Solo en el stock de hoy (`source: 'live'`). */
  inTransit?: number;
  pendingReturn?: number;
  /** Sin permiso: no viene. `null` = sin costo. */
  value?: number | null;
}

export interface StockReportItem extends ReportCatalogInfo {
  variantId: string;
  physical: number;
  reserved: number;
  available: number;
  inTransit?: number;
  pendingReturn?: number;
  averageCost?: number | null;
  value?: number | null;
  warehouses: StockReportCell[];
}

export interface StockReportTotals {
  variants: number;
  physical: number;
  reserved: number;
  available: number;
  value?: number | null;
  withoutCost: { variants: number; units: number };
}

export interface StockReportData {
  available: true;
  date: string;
  asOf: string | null;
  source: ReportSource;
  closePeriod: string | null;
  cutoffAt: string | null;
  warehouses: ReportWarehouse[];
  items: StockReportItem[];
  totals: StockReportTotals;
  /** Cantidad de variantes (no es un monto). */
  total: number;
  page: number;
  limit: number;
  truncated?: boolean;
  q?: string;
}

export type StockReport = StockReportData | ReportUnavailable;

export interface StockReportFilters {
  /** YYYY-MM-DD de Lima; sin fecha, hoy. */
  date?: string;
  inventoryId?: string;
  q?: string;
  onlyWithStock?: boolean;
  page?: number;
  limit?: number;
  /** Todo de una vez, para exportar (tope 20.000 variantes). */
  all?: boolean;
}

const bool = (value: boolean | undefined) => (value ? "true" : undefined);

/** Quita los parámetros vacíos (la fachada valida cada uno). */
function clean(params: Record<string, string | number | undefined | null>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export async function getStockReport(filters: StockReportFilters = {}, signal?: AbortSignal): Promise<StockReport> {
  const { data } = await axiosAuth.get<StockReport>(`${products()}/inventory-reports/stock`, {
    params: clean({
      date: filters.date,
      inventoryId: filters.inventoryId,
      q: filters.q?.trim(),
      onlyWithStock: bool(filters.onlyWithStock),
      page: filters.all ? undefined : filters.page,
      limit: filters.all ? undefined : filters.limit,
      all: bool(filters.all),
    }),
    signal,
  });
  return data;
}

/* ---------------------------------------------------------------------------
   Valorizado
--------------------------------------------------------------------------- */

export interface ValuationWarehouse {
  inventoryId: string;
  name: string;
  type?: string | null;
  isMain?: boolean;
  items: number;
  units: number;
  value?: number | null;
  withoutCost: { items: number; units: number };
}

export interface ValuationData {
  available: true;
  date: string;
  asOf: string | null;
  source: ReportSource;
  closePeriod: string | null;
  cutoffAt: string | null;
  warehouses: ValuationWarehouse[];
  totals: {
    items: number;
    variants: number;
    units: number;
    value?: number | null;
    withoutCost: { items: number; units: number; variants: number };
  };
}

export type ValuationReport = ValuationData | ReportUnavailable;

export async function getValuation(filters: { date?: string; inventoryId?: string } = {}, signal?: AbortSignal): Promise<ValuationReport> {
  const { data } = await axiosAuth.get<ValuationReport>(`${products()}/inventory-reports/valuation`, {
    params: clean({ date: filters.date, inventoryId: filters.inventoryId }),
    signal,
  });
  return data;
}

/* ---------------------------------------------------------------------------
   Kardex (movimientos)
--------------------------------------------------------------------------- */

export interface KardexRow {
  id: string;
  createdAt: string;
  type: string;
  variantId: string;
  inventoryId: string;
  inventoryName: string | null;
  quantity: number;
  /** `null` en las filas anteriores al libro de stock. */
  physicalDelta: number | null;
  reservedDelta: number | null;
  physicalAfter: number | null;
  reservedAfter: number | null;
  transitDelta?: number | null;
  transitAfter?: number | null;
  pendingReturnDelta?: number | null;
  pendingReturnAfter?: number | null;
  /** Sin permiso: no vienen. */
  unitCost?: number | null;
  averageCostAfter?: number | null;
  value?: number | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  originMovementId?: string | null;
  userEmail: string | null;
  userName: string | null;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  companySku: string | null;
  attributes: Record<string, string> | null;
}

export interface KardexPage {
  items: KardexRow[];
  /** Cantidad de filas (no es un monto). */
  total: number;
  page: number;
  limit: number;
  /** Con `all`: había más de 10.000 filas y se cortó. */
  truncated?: boolean;
}

export interface KardexFilters {
  variantId?: string;
  inventoryId?: string;
  /** Tipos de movimiento (se mandan separados por coma). */
  types?: string[];
  from?: string;
  to?: string;
  /** Número de documento exacto (ORD-…, OC-0001, REC-0001), sin mayúsculas. */
  document?: string;
  page?: number;
  limit?: number;
  /** Todas las filas, para exportar (tope 10.000). */
  all?: boolean;
}

export async function getKardex(filters: KardexFilters = {}, signal?: AbortSignal): Promise<KardexPage> {
  const { data } = await axiosAuth.get<KardexPage>(`${products()}/inventory-reports/kardex`, {
    params: clean({
      variantId: filters.variantId,
      inventoryId: filters.inventoryId,
      types: filters.types?.length ? filters.types.join(",") : undefined,
      from: filters.from,
      to: filters.to,
      document: filters.document?.trim(),
      page: filters.all ? undefined : filters.page,
      limit: filters.all ? undefined : filters.limit,
      all: bool(filters.all),
    }),
    signal,
  });
  return { ...data, items: Array.isArray(data?.items) ? data.items : [] };
}

/* ---------------------------------------------------------------------------
   Reporte de compras
--------------------------------------------------------------------------- */

export interface PurchasesReportSupplier {
  supplierId: string | null;
  supplierName: string | null;
  amount?: number;
  units: number;
  orders: number;
  share?: number;
  lastDate: string | null;
}

export interface PurchasesReportVariant {
  variantId: string;
  sku: string | null;
  productName: string | null;
  productId?: string | null;
  attributes?: Record<string, string> | null;
  brandId?: string | null;
  brandName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  units: number;
  amount?: number;
  averageUnitCost?: number;
  suppliers: Array<{ supplierId: string | null; supplierName: string | null }>;
}

export interface PurchasesReportGroup {
  units: number;
  amount?: number;
  variants: number;
  share?: number;
}

export interface PurchasesReportProduct extends PurchasesReportGroup {
  productId: string | null;
  productName: string | null;
  brandName?: string | null;
  categoryName?: string | null;
}

export interface PurchasesReportOrder {
  id: string;
  number: string;
  date: string;
  origin: string;
  status: string;
  supplierNames: string[] | string | null;
  units: number;
  amount?: number;
}

export interface PurchasesReport {
  from: string;
  to: string;
  totals: { amount?: number; units: number; orders: number; suppliers: number; averageTicket?: number };
  byMonth: Array<{ month: string; amount?: number; units: number; orders: number }>;
  bySupplier: PurchasesReportSupplier[];
  byVariant: PurchasesReportVariant[];
  byProduct: PurchasesReportProduct[];
  byBrand: Array<PurchasesReportGroup & { brandId: string | null; brandName: string | null }>;
  byCategory: Array<PurchasesReportGroup & { categoryId: string | null; categoryName: string | null }>;
  topProducts: PurchasesReportProduct[];
  topSuppliers: PurchasesReportSupplier[];
  topSupplier: PurchasesReportSupplier | null;
  orders: PurchasesReportOrder[];
}

/** Por rango (`from`/`to`) o por periodo (`YYYY-MM`). Sin nada, el mes en curso. */
export async function getPurchasesReport(
  filters: { from?: string; to?: string; period?: string } = {},
  signal?: AbortSignal,
): Promise<PurchasesReport> {
  const { data } = await axiosAuth.get<PurchasesReport>(`${products()}/inventory-reports/purchases`, {
    params: clean(filters.period ? { period: filters.period } : { from: filters.from, to: filters.to }),
    signal,
  });
  const list = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);
  return {
    ...data,
    byMonth: list(data?.byMonth),
    bySupplier: list(data?.bySupplier),
    byVariant: list(data?.byVariant),
    byProduct: list(data?.byProduct),
    byBrand: list(data?.byBrand),
    byCategory: list(data?.byCategory),
    topProducts: list(data?.topProducts),
    topSuppliers: list(data?.topSuppliers),
    orders: list(data?.orders),
    topSupplier: data?.topSupplier ?? null,
  };
}

/* ---------------------------------------------------------------------------
   Alertas
--------------------------------------------------------------------------- */

export type InventoryAlertType =
  | "bajo_minimo"
  | "sin_stock_con_pedidos"
  | "reservas_viejas"
  | "devoluciones_por_recibir"
  | "sku_por_vincular"
  | "lotes_por_vencer"
  | "investigacion_vencida"
  | "conciliacion_con_diferencia"
  | "packs_bajo_margen";

export interface LowStockAlertItem {
  inventoryId: string;
  inventoryName: string | null;
  variantId: string;
  physical: number;
  reserved: number;
  available: number;
  minStock: number;
  outOfStock: boolean;
  productName?: string | null;
  sku?: string | null;
  attributes?: Record<string, string> | null;
}

export interface OutOfStockAlertItem {
  orderId: string;
  inventoryId: string;
  since: string | null;
  ageDays: number | null;
  lines: Array<{ variantId: string | null; quantity: number }>;
}

export interface OldReservationAlertItem {
  orderId: string;
  inventoryId: string;
  reservedAt: string | null;
  ageDays: number | null;
  releasesAt: string | null;
}

export interface PendingReturnAlertItem {
  id: string;
  orderId: string;
  orderNumber: string | null;
  inventoryId: string;
  createdAt: string | null;
  ageDays: number | null;
  units: number;
}

export interface InventoryAlert {
  type: InventoryAlertType | string;
  enabled: boolean;
  count: number;
  items: unknown[];
  /** Hito del que depende una alerta apagada (H5, H9). */
  dependsOn?: string;
  releaseAfterDays?: number | null;
  thresholdDays?: number | null;
}

export interface InventoryAlerts {
  generatedAt: string;
  /** Suma de las alertas (no es un monto). */
  total: number;
  alerts: InventoryAlert[];
}

export async function getInventoryAlerts(limit?: number, signal?: AbortSignal): Promise<InventoryAlerts> {
  const { data } = await axiosAuth.get<InventoryAlerts>(`${products()}/inventory-reports/alerts`, {
    params: clean({ limit }),
    signal,
  });
  return {
    generatedAt: data?.generatedAt ?? "",
    total: Number(data?.total) || 0,
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
  };
}

/* ---------------------------------------------------------------------------
   Cierre mensual
--------------------------------------------------------------------------- */

export type PeriodCloseStatus = "cerrado" | "reabierto";

export interface PeriodClose {
  id: string;
  /** YYYY-MM */
  period: string;
  status: PeriodCloseStatus;
  periodStart: string;
  periodEnd: string;
  lastDay: string;
  closedAt: string | null;
  closedBy: string | null;
  closedByName: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
  itemsCount: number;
  units: number;
  /** Sin permiso: no viene. */
  totalValue?: number | null;
  uncostedItems: number;
  uncostedUnits: number;
}

export interface PeriodCloseList {
  items: PeriodClose[];
  /** Mes en curso (YYYY-MM, Lima). */
  currentPeriod: string;
  /** El próximo mes que se puede cerrar; `null` si no hay ninguno. */
  nextToClose: string | null;
}

export interface PeriodCloseSnapshotItem {
  inventoryId: string;
  inventoryName: string | null;
  variantId: string;
  physical: number;
  reserved: number;
  averageCost?: number | null;
  value?: number | null;
  productName: string | null;
  sku: string | null;
  attributes: Record<string, string> | null;
}

export interface PeriodCloseDetail extends PeriodClose {
  items: PeriodCloseSnapshotItem[];
}

const periodsBase = () => `${products()}/period-closes`;

export async function listPeriodCloses(signal?: AbortSignal): Promise<PeriodCloseList> {
  const { data } = await axiosAuth.get<PeriodCloseList>(periodsBase(), { signal });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    currentPeriod: data?.currentPeriod ?? "",
    nextToClose: data?.nextToClose ?? null,
  };
}

export async function getPeriodClose(period: string, signal?: AbortSignal): Promise<PeriodCloseDetail> {
  const { data } = await axiosAuth.get<PeriodCloseDetail>(`${periodsBase()}/${encodeURIComponent(period)}`, { signal });
  return { ...data, items: Array.isArray(data?.items) ? data.items : [] };
}

/** Solo Administrador (403 al resto). 409 si el mes no terminó, falta el anterior o ya está cerrado. */
export async function closePeriod(period: string): Promise<PeriodClose> {
  const { data } = await axiosAuth.post<PeriodClose>(periodsBase(), { period });
  return data;
}

/** Solo Administrador. Motivo de 3 a 500 caracteres. 409 si un periodo posterior sigue cerrado. */
export async function reopenPeriod(period: string, reason: string): Promise<PeriodClose> {
  const { data } = await axiosAuth.post<PeriodClose>(`${periodsBase()}/${encodeURIComponent(period)}/reopen`, { reason });
  return data;
}
