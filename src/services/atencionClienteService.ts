import axiosAuth from "@/lib/axiosAuth";
import { OrderHeader, SubEstadoCc, TipoGestionCC, KpisCC, CcKpisFinancierosResponse, CcKpisFunnelResponse, CcStorePerformanceItem, CcUpsellResponse, CcAgingResponse, CcIntentosResponse, CcUpsellRecordsResponse } from "@/interfaces/IOrder";

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export interface PedidosCcFilters {
  tipoGestion?: TipoGestionCC;
  subEstado?: SubEstadoCc;
  agenteId?: string;
  unassigned?: boolean;
  canalOrigen?: string;
  storeId?: string;
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

export async function getPedidosCC(filters: PedidosCcFilters): Promise<PaginatedCcResult> {
  const params = new URLSearchParams();
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
  const res = await axiosAuth.get<PaginatedCcResult>(`${BASE}/atencion-al-cliente/pedidos?${params}`);
  return res.data;
}

export async function getKpisCC(tipoGestion: TipoGestionCC, storeId: string): Promise<KpisCC> {
  const res = await axiosAuth.get<KpisCC>(
    `${BASE}/atencion-al-cliente/kpis?tipoGestion=${tipoGestion}&storeId=${storeId}`,
  );
  return res.data;
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
