import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H1-D (H1D-5) — stock de Shopify por tienda. Va por la fachada con JWT
// de ms-integrations (`/shopify/stock/**`), que toma la empresa del token: este
// servicio nunca envía un companyId. Generar reporte y cambiar modo exigen rol
// administrador (403 si no).

const base = () => process.env.NEXT_PUBLIC_API_INTEGRATIONS || GATEWAY.integrations;

/** `shopify` = Shopify manda (hoy), `reporte` = solo compara, `powip` = Powip publica en Shopify. */
export type ShopifyStockMode = "shopify" | "reporte" | "powip";
export type ShopifyHealthStatus = "ok" | "token_revocado" | "plan_impago" | "desinstalada" | "error";
export type ShopifyStockRunStatus = "running" | "ok" | "error" | "skipped";

/** Contadores de una corrida (mismos nombres que las columnas de ms-integrations). */
export interface ShopifyStockCounters {
  seen: number;
  linked: number;
  skipped_unlinked: number;
  skipped_sku_only: number;
  skipped_duplicate: number;
  skipped_untracked: number;
  to_publish: number;
  published: number;
  skipped_changed: number;
  errors: number;
  tracked_deny_count: number;
  locations_count: number;
  pending_orders_imported: number;
  skipped_not_in_warehouse: number;
  skipped_not_stocked: number;
  skipped_out_of_range: number;
  unchanged: number;
  would_zero: number;
  would_zero_deny: number;
  skipped_sku_mismatch: number;
  multi_location_diff: number;
}

export interface ShopifyStockRun {
  id: string;
  mode: "reporte" | "powip";
  status: ShopifyStockRunStatus;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  stockLocationId: string | null;
  inventoryId: string | null;
  writeBlockedReason: string | null;
  counters: ShopifyStockCounters;
}

export interface ShopifyStockShop {
  id: string;
  shopUrl: string;
  storeId: string | null;
  inventoryId: string | null;
  stockMode: ShopifyStockMode;
  stockLocationId: string | null;
  isActive: boolean;
  healthStatus: ShopifyHealthStatus;
  needsReauthorization: boolean;
  stockPublishError: string | null;
  stockPublishErrorAt: string | null;
  stockAckOnlineLocations: string[] | null;
  /** Última corrida terminada (la del reporte). */
  lastRun: ShopifyStockRun | null;
  /** Corrida en curso, si hay. */
  runningRun: { id: string; startedAt: string | null } | null;
}

export interface ShopifyStockShops {
  generatedAt: string;
  shops: ShopifyStockShop[];
}

export interface ShopifyStockReportItem {
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  shopifySku: string | null;
  powipSku: string | null;
  powipVariantId: string | null;
  signal: string | null;
  confidence: number | null;
  tracked: boolean | null;
  inventoryPolicy: string | null;
  shopifyAvailable: number | null;
  shopifyAvailableTotal: number | null;
  powipAvailable: number | null;
  detail: string | null;
}

export interface ShopifyStockReportGroup {
  action: string;
  total: number;
  items: ShopifyStockReportItem[];
}

export interface ShopifyStockReport {
  generatedAt: string;
  shop: {
    id: string;
    shopUrl: string;
    stockMode: ShopifyStockMode;
    stockLocationId: string | null;
    stockPublishError: string | null;
    stockPublishErrorAt: string | null;
    isActive: boolean;
    healthStatus: ShopifyHealthStatus;
    needsReauthorization: boolean;
    hasInventory: boolean;
    stockAckOnlineLocations: string[] | null;
  };
  run: ShopifyStockRun | null;
  locationsCount: number | null;
  trackedDenyCount: number | null;
  itemsLimit: number;
  groups: ShopifyStockReportGroup[];
  multiLocation: { total: number; items: ShopifyStockReportItem[] };
  wouldZeroDeny: { total: number; items: ShopifyStockReportItem[] };
}

export interface ShopifyLocation {
  id: string;
  legacyId: string | null;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
}

export interface ShopifyStockLocations {
  shopId: string;
  shopUrl: string;
  stockLocationId: string | null;
  locations: ShopifyLocation[];
}

export interface ShopifyStockRunRequest {
  shopId: string;
  shopUrl: string;
  runId: string;
  status: "running";
  startedAt: string | null;
  dryRun: true;
}

export interface ShopifyStockRunState {
  shopId: string;
  run: ShopifyStockRun;
}

export type ShopifyStockPreconditionCode =
  | "modo_powip_habilitado"
  | "confirmacion"
  | "tienda_activa"
  | "salud_ok"
  | "sin_reautorizacion"
  | "almacen_powip"
  | "scopes_lectura"
  | "scope_write_inventory"
  | "ubicacion"
  | "ubicaciones_online"
  | "almacen_compartido"
  | "ultimo_reporte_ok"
  | "reporte_misma_ubicacion"
  | "reporte_mismo_almacen"
  | "reporte_reciente"
  | "venta_bloqueada";

export interface ShopifyStockPrecondition {
  code: ShopifyStockPreconditionCode | string;
  ok: boolean;
  message: string;
}

/** Respuesta del cambio de modo; la misma forma viaja en el 422 y en el 409. */
export interface ShopifyStockModeResult {
  shopId: string;
  shopUrl: string;
  requestedMode: ShopifyStockMode;
  previousMode: ShopifyStockMode;
  currentMode: ShopifyStockMode;
  changed: boolean;
  stockLocationId: string | null;
  preconditions: ShopifyStockPrecondition[];
  unmet: string[];
  warnings: string[];
  locations: ShopifyLocation[] | null;
  lastRun: ShopifyStockRun | null;
  group?: ShopifyStockModeResult[];
}

export interface ShopifyStockModeChange {
  mode: ShopifyStockMode;
  stockLocationId?: string;
  confirm?: boolean;
  acknowledgeZeroDeny?: boolean;
  acknowledgeMultiLocation?: boolean;
  groupShopIds?: string[];
}

export type ShopifyReauthorizationReason =
  | "token_revocado"
  | "desinstalada"
  | "token_rechazado"
  | "marcada_para_reautorizar"
  | "faltan_scopes";

export interface ShopifyShopReauthorization {
  shopId: string;
  shopUrl: string;
  storeId: string | null;
  isActive: boolean;
  healthStatus: ShopifyHealthStatus;
  tokenHealthy: boolean | null;
  grantedScopes: string[] | null;
  missingScopes: string[] | null;
  scopesCheckedAt: string | null;
  scopesSource: string | null;
  scopesError: string | null;
  needsReauthorization: boolean;
  reasons: ShopifyReauthorizationReason[];
  /** Absoluta, o relativa a ms-integrations (`/shopify/reauth/<tienda>`). */
  reauthorizeUrl: string;
}

export interface ShopifyReauthorizationStatus {
  generatedAt: string;
  requiredScopes: string[];
  shops: ShopifyShopReauthorization[];
}

const enc = encodeURIComponent;

export async function listShopifyStockShops(): Promise<ShopifyStockShops> {
  const { data } = await axiosAuth.get<ShopifyStockShops>(`${base()}/shopify/stock/shops`);
  return data;
}

export async function getShopifyStockReport(shopId: string, limit = 50): Promise<ShopifyStockReport> {
  const { data } = await axiosAuth.get<ShopifyStockReport>(`${base()}/shopify/stock/shops/${enc(shopId)}/report`, {
    params: { limit },
  });
  return data;
}

export async function getShopifyStockLocations(shopId: string): Promise<ShopifyStockLocations> {
  const { data } = await axiosAuth.get<ShopifyStockLocations>(`${base()}/shopify/stock/shops/${enc(shopId)}/locations`);
  return data;
}

/** Reporte a pedido (nunca escribe en Shopify). 409 si ya hay una corrida de la tienda. */
export async function requestShopifyStockRun(shopId: string): Promise<ShopifyStockRunRequest> {
  const { data } = await axiosAuth.post<ShopifyStockRunRequest>(`${base()}/shopify/stock/shops/${enc(shopId)}/runs`);
  return data;
}

export async function getShopifyStockRun(runId: string): Promise<ShopifyStockRunState> {
  const { data } = await axiosAuth.get<ShopifyStockRunState>(`${base()}/shopify/stock/runs/${enc(runId)}`);
  return data;
}

/** Cambia el modo de stock. 422 con las precondiciones que faltan; 409 si la tienda cambió en el medio. */
export async function changeShopifyStockMode(
  shopId: string,
  change: ShopifyStockModeChange,
): Promise<ShopifyStockModeResult> {
  const { data } = await axiosAuth.patch<ShopifyStockModeResult>(
    `${base()}/shopify/stock/shops/${enc(shopId)}/mode`,
    change,
  );
  return data;
}

/** Estado de re-autorización (scopes de inventario que faltan) de las tiendas de la empresa del token. */
export async function getShopifyReauthorizationStatus(refresh = false): Promise<ShopifyReauthorizationStatus> {
  const { data } = await axiosAuth.get<ShopifyReauthorizationStatus>(`${base()}/shopify/reauthorization-status`, {
    params: refresh ? { refresh: true } : undefined,
  });
  return data;
}

/** Base de ms-integrations, para completar una `reauthorizeUrl` relativa. */
export function integrationsBaseUrl(): string {
  return base().replace(/\/$/, "");
}
