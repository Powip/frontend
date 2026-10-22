import type { ConfirmCommercialOrderPurchaseInput, LeadConfirmationCapabilities, LeadConfirmationResponse } from "@/types/leads";
import axiosAuth from "@/lib/axiosAuth";
import { OrderHeader, SubEstadoCc, TipoGestionCC, KpisCC, CcKpisFinancierosResponse, CcKpisFunnelResponse, CcStorePerformanceItem, CcUpsellResponse, CcAgingResponse, CcIntentosResponse, CcUpsellRecordsResponse } from "@/interfaces/IOrder";

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export interface PedidosCcFilters {
  dateBasis?: "CREATED" | "COMMERCIAL_EVENTS";
  tipoGestion?: TipoGestionCC;
  subEstado?: SubEstadoCc;
  agenteId?: string;
  unassigned?: boolean;
  canalOrigen?: string;
  storeId?: string;
  storeIds?: string[];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCcResult {
  data: OrderHeader[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getPedidosCC(
  filters: PedidosCcFilters,
  signal?: AbortSignal,
): Promise<PaginatedCcResult> {
  if (filters.storeIds) {
    const result = await getAllPedidosCC(filters, signal);
    if (result.truncated) throw new Error("No se pudieron cargar todos los pedidos del negocio");
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    return { data: result.data.slice((page - 1) * limit, page * limit), total: result.total, page, totalPages: Math.max(1, Math.ceil(result.total / limit)) };
  }
  const params = new URLSearchParams();
  if (filters.dateBasis) params.set("dateBasis", filters.dateBasis);
  if (filters.tipoGestion)     params.set("tipoGestion", filters.tipoGestion);
  if (filters.subEstado)       params.set("subEstado", filters.subEstado);
  if (filters.unassigned)      params.set("unassigned", "true");
  else if (filters.agenteId)   params.set("agenteId", filters.agenteId);
  if (filters.canalOrigen)     params.set("canalOrigen", filters.canalOrigen);
  if (filters.storeId)         params.set("storeId", filters.storeId);
  if (filters.startDate)       params.set("startDate", filters.startDate);
  if (filters.endDate)         params.set("endDate", filters.endDate);
  if (filters.page)            params.set("page", String(filters.page));
  if (filters.limit)           params.set("limit", String(filters.limit));
  const res = await axiosAuth.get<PaginatedCcResult>(
    `${BASE}/atencion-al-cliente/pedidos?${params}`,
    { signal },
  );
  return res.data;
}

/** Tamaño pedido al backend; puede aplicar un tope menor, por eso el corte usa `total`. */
const ALL_PEDIDOS_PAGE_SIZE = 200;
/** Resguardo de requests secuenciales por búsqueda (≤ 4000 pedidos si se respeta el tamaño). */
const ALL_PEDIDOS_MAX_PAGES = 20;

export interface AllPedidosCcResult {
  data: OrderHeader[];
  /** Total informado por el backend para los filtros. */
  total: number;
  /** true si quedaron pedidos sin traer (data.length < total). */
  truncated: boolean;
}

/**
 * Trae todas las páginas de /atencion-al-cliente/pedidos para los filtros dados.
 * El endpoint no acepta búsqueda por texto, así que el buscador de Gestión COD
 * filtra en cliente sobre este conjunto completo (mismo patrón que
 * cierreDiaProductosService.fetchAllPedidosCC).
 *
 * No asume que el backend respete `limit`: sigue pidiendo páginas mientras lo
 * acumulado sea menor que el `total` real de la respuesta (totalPages solo se
 * usa si el backend no informa total). Deduplica por id por si el listado se
 * desplaza entre páginas mientras se descarga.
 */
export async function getAllPedidosCC(
  filters: Omit<PedidosCcFilters, "page" | "limit">,
  signal?: AbortSignal,
): Promise<AllPedidosCcResult> {
  if (filters.storeIds) {
    const results = await Promise.all([...new Set(filters.storeIds)].map((storeId) => getAllPedidosCC({ ...filters, storeIds: undefined, storeId }, signal)));
    const data = Array.from(new Map(results.flatMap((result) => result.data).map((order) => [order.id, order])).values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.id.localeCompare(b.id));
    return { data, total: results.reduce((sum, result) => sum + result.total, 0), truncated: results.some((result) => result.truncated) };
  }
  const byId = new Map<string, OrderHeader>();
  let total: number | undefined;
  let totalPages = 1;
  let page = 1;
  let exhausted = false;

  while (page <= ALL_PEDIDOS_MAX_PAGES) {
    const res = await getPedidosCC({ ...filters, page, limit: ALL_PEDIDOS_PAGE_SIZE }, signal);
    const rows = res.data ?? [];
    rows.forEach((o) => byId.set(o.id, o));
    if (typeof res.total === "number") total = res.total;
    if (typeof res.totalPages === "number") totalPages = res.totalPages;

    const done =
      rows.length === 0 ||
      (total !== undefined ? byId.size >= total : page >= totalPages);
    if (done) { exhausted = true; break; }
    page += 1;
  }

  const data = [...byId.values()];
  const realTotal = total ?? data.length;
  return {
    data,
    total: realTotal,
    truncated: data.length < realTotal || (!exhausted && total === undefined),
  };
}

export async function getKpisCC(tipoGestion: TipoGestionCC, scope: string | string[], signal?: AbortSignal): Promise<KpisCC> {
  const storeIds = typeof scope === "string" ? [scope] : [...new Set(scope)];
  const results = await Promise.all(storeIds.map(async (storeId) => {
    const res = await axiosAuth.get<KpisCC>(`${BASE}/atencion-al-cliente/kpis`, { params: { tipoGestion, storeId }, signal });
    return res.data;
  }));
  if (results.length === 1) return results[0];
  const merged: KpisCC = { efectividadHoy: 0, confirmadosMes: 0, gestionadosMes: 0, efectividadMes: 0, upsellHoy: 0, upsellMensual: 0 };
  for (const result of results) for (const [key, value] of Object.entries(result)) {
    if (key !== "efectividadHoy" && key !== "efectividadMes") merged[key] = (merged[key] ?? 0) + Number(value || 0);
  }
  merged.efectividadMes = merged.gestionadosMes > 0 ? Math.round(100 * merged.confirmadosMes / merged.gestionadosMes) : 0;
  // Versiones anteriores del API no proporcionan bases diarias: evitar promediar porcentajes.
  merged.efectividadHoy = results.every((result) => typeof result.confirmadosHoy === "number" && typeof result.gestionadosHoy === "number")
    ? (merged.gestionadosHoy > 0 ? Math.round(100 * merged.confirmadosHoy / merged.gestionadosHoy) : 0) : Number.NaN;
  return merged;
}

export async function updateSubEstadoCC(
  orderId: string,
  nuevoSubEstado: SubEstadoCc,
  comentario?: string,
): Promise<{ autoCanceled: boolean }> {
  const res = await axiosAuth.patch<{ autoCanceled: boolean }>(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/sub-estado`,
    { nuevoSubEstado, comentario },
  );
  return res.data;
}

export async function updateDatosClienteCC(
  orderId: string,
  datos: { dniCliente?: string; referenciaEntrega?: string; horarioEntregaLima?: string },
): Promise<OrderHeader> {
  const res = await axiosAuth.patch<OrderHeader>(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/datos-cliente`,
    datos,
  );
  return res.data;
}

export async function enviarPedidoALima(orderId: string): Promise<void> {
  await axiosAuth.patch(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/enviar-lima`,
  );
}

export async function confirmarEntregaLima(
  orderId: string,
  horarioEntregaLima: string,
): Promise<void> {
  await axiosAuth.patch(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/confirmar-entrega-lima`,
    { horarioEntregaLima },
  );
}

export async function confirmarDespacho(orderId: string): Promise<void> {
  await axiosAuth.post(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/confirmar-despacho`,
  );
}

export async function getCcOrderConfirmationCapabilities(
  orderId: string,
): Promise<LeadConfirmationCapabilities> {
  return (await axiosAuth.get<LeadConfirmationCapabilities>(
    `${BASE}/atencion-al-cliente/pedidos/${encodeURIComponent(orderId)}/confirmation-capabilities`,
  )).data;
}

export async function confirmarVentaCc(
  orderId: string,
  command: ConfirmCommercialOrderPurchaseInput,
): Promise<LeadConfirmationResponse> {
  return (await axiosAuth.post<LeadConfirmationResponse>(
    `${BASE}/atencion-al-cliente/pedidos/${encodeURIComponent(orderId)}/confirmar-venta`,
    command,
  )).data;
}

export async function recuperarVentaCC(orderId: string): Promise<void> {
  await axiosAuth.post(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/recuperar`,
  );
}

export async function reassignSeller(
  orderId: string,
  sellerId: string,
  sellerName: string,
  requestingUserId?: string,
  requestingUserName?: string,
): Promise<void> {
  await axiosAuth.patch(`${BASE}/order-header/${orderId}/seller`, {
    sellerId,
    sellerName,
    requestingUserId,
    requestingUserName,
  });
}

export async function reasignarPedido(
  orderId: string,
  nuevoAgenteId: string | null,
): Promise<void> {
  await axiosAuth.patch(
    `${BASE}/atencion-al-cliente/pedidos/${orderId}/reasignar`,
    { nuevoAgenteId },
  );
}

export async function getKpisFinancieros(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcKpisFinancierosResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcKpisFinancierosResponse>(
    `${BASE}/atencion-al-cliente/kpis/financials?${params}`,
  );
  return res.data;
}

export async function getKpisFunnel(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcKpisFunnelResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcKpisFunnelResponse>(
    `${BASE}/atencion-al-cliente/kpis/funnel?${params}`,
  );
  return res.data;
}

export async function getStorePerformance(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcStorePerformanceItem[]> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcStorePerformanceItem[]>(
    `${BASE}/atencion-al-cliente/kpis/store-performance?${params}`,
  );
  return res.data;
}

export async function getKpisUpsell(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcUpsellResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcUpsellResponse>(
    `${BASE}/atencion-al-cliente/kpis/upsell?${params}`,
  );
  return res.data;
}

export async function getKpisAging(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcAgingResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcAgingResponse>(
    `${BASE}/atencion-al-cliente/kpis/aging?${params}`,
  );
  return res.data;
}

export async function getKpisIntentos(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcIntentosResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcIntentosResponse>(
    `${BASE}/atencion-al-cliente/kpis/intentos?${params}`,
  );
  return res.data;
}

export async function getUpsellRecords(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<CcUpsellRecordsResponse> {
  const params = new URLSearchParams({ storeId, startDate, endDate });
  const res = await axiosAuth.get<CcUpsellRecordsResponse>(
    `${BASE}/atencion-al-cliente/upsell-records?${params}`,
  );
  return res.data;
}
