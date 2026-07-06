// Client-side API functions for the finanzas/courier module.
// All requests go through Next.js API routes — never directly to microservices.

const BASE = "/api/finanzas";

function authHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ----- Types -----

export interface EnAgenciaData {
  amount: number;
  count: number;
  carrier: string | null;
}

export interface ReassignedData {
  count: number;
  subtitle: string;
}

export interface TopMetricsData {
  pendingCod: {
    amount: number;
    count: number;
  };
  overdue: {
    amount: number;
    count: number;
    courier: string | null;
  };
  liquidatedThisMonth: {
    amount: number;
    count: number;
    month: string;
    year: number;
  };
}

export interface CourierPerformanceItem {
  name: string;
  score: string;
  description?: string;
  status?: string;
  avgRenditionDays: number;
  codPendiente: number;
  enAgencia: number;
  totalGuias: number;
  weeklyData?: { week: string; rendido: number; pendiente: number }[];
  [key: string]: unknown;
}

export interface TableRow {
  id: string;
  date: string;
  courierName?: string;
  courier?: string;
  courierScore?: string;
  score?: string;
  tipo: string;
  pedidosCount: number;
  pedidosEnAgencia: number;
  pedidosConAlerta: number;
  pedidosReasignados: number;
  codBruto: number;
  adelantos: number;
  codNeto: number;
  costos: number;
  neto: number;
  estado: string;
  diasPendiente: number;
  diasMaximo: number;
  [key: string]: unknown;
}

export interface LiquidationDetails {
  id: string;
  [key: string]: unknown;
}

export interface CreateLiquidationPayload {
  monto: number;
  metodo: string;
  numeroOperacion?: string;
  fecha: string;
  observaciones?: string;
  cobrarOpcion?: "todo" | "solo_envio" | "nada";
}

// ----- API functions -----

export async function getEnAgencia(storeId: string, token?: string | null): Promise<EnAgenciaData> {
  const res = await fetch(`${BASE}/en-agencia?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<EnAgenciaData>(res);
}

export async function getReassigned(storeId: string, token?: string | null): Promise<ReassignedData> {
  const res = await fetch(`${BASE}/reassigned?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<ReassignedData>(res);
}

export async function getTopMetrics(storeId: string, token?: string | null): Promise<TopMetricsData> {
  const res = await fetch(`${BASE}/top-metrics?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<TopMetricsData>(res);
}

export async function getDashboardMetrics(storeId: string, token?: string | null): Promise<Record<string, number>> {
  const res = await fetch(`${BASE}/metrics?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<Record<string, number>>(res);
}

export async function getCourierPerformance(storeId: string, token?: string | null): Promise<CourierPerformanceItem[]> {
  const res = await fetch(`${BASE}/courier-performance?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<CourierPerformanceItem[]>(res);
}

export async function getLiquidationsTable(storeId: string, token?: string | null): Promise<TableRow[]> {
  const res = await fetch(`${BASE}/table?storeId=${storeId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<TableRow[]>(res);
}

export async function getLiquidationDetails(
  liquidationId: string,
  token?: string | null
): Promise<LiquidationDetails> {
  const res = await fetch(`${BASE}/liquidations/${liquidationId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<LiquidationDetails>(res);
}

export async function createLiquidation(
  storeId: string,
  payload: CreateLiquidationPayload,
  token?: string | null
): Promise<unknown> {
  const res = await fetch(`${BASE}/liquidations?storeId=${storeId}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<unknown>(res);
}

export async function markOverdue(storeId: string, token?: string | null): Promise<unknown> {
  const res = await fetch(`${BASE}/liquidations/mark-overdue?storeId=${storeId}`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return handleResponse<unknown>(res);
}

export interface UpdateLiquidationPayload {
  collectedAmount?: number;
  settlementStatus?: "PENDIENTE" | "PARCIAL" | "LIQUIDADO" | "VENCIDO" | "SIN_COD";
  notes?: string;
  liquidatedAt?: string;
}

export interface CreatePaymentPayload {
  monto: number;
  metodo: "transferencia" | "yape" | "efectivo" | "no-aplica";
  numeroOperacion?: string;
  fecha: string;
  comprobante?: File;
  observaciones?: string;
  cobrarOpcion: "todo" | "solo_envio" | "nada";
}

function buildPaymentFormData(payload: CreatePaymentPayload): FormData {
  const formData = new FormData();
  formData.append("monto", String(payload.monto));
  formData.append("metodo", payload.metodo);
  formData.append("fecha", payload.fecha);
  formData.append("cobrarOpcion", payload.cobrarOpcion);
  if (payload.numeroOperacion) formData.append("numeroOperacion", payload.numeroOperacion);
  if (payload.observaciones) formData.append("observaciones", payload.observaciones);
  if (payload.comprobante) formData.append("comprobante", payload.comprobante);
  return formData;
}

export async function createLiquidationPayment(
  liquidationId: string,
  payload: CreatePaymentPayload,
  token?: string | null
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(
    `${BASE}/liquidations/${liquidationId}/transactions/payments`,
    { method: "POST", headers, body: buildPaymentFormData(payload), cache: "no-store" } as RequestInit,
  );
  return handleResponse<unknown>(res);
}

export async function createFreightPayment(
  liquidationId: string,
  payload: CreatePaymentPayload,
  token?: string | null
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(
    `${BASE}/liquidations/${liquidationId}/freight-payments`,
    { method: "POST", headers, body: buildPaymentFormData(payload), cache: "no-store" } as RequestInit,
  );
  return handleResponse<unknown>(res);
}

export async function updateLiquidation(
  storeId: string,
  liquidationId: string,
  payload: UpdateLiquidationPayload,
  token?: string | null
): Promise<unknown> {
  const res = await fetch(
    `${BASE}/liquidations/${liquidationId}?storeId=${storeId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  return handleResponse<unknown>(res);
}
