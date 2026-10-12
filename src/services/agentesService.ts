import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { AgenteConKpis, AgentePerformanceKpis } from "@/interfaces/IOrder";

const BASE_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;
const API_AUTH =
  process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "") ||
  "http://localhost:8080";

export interface VendedorOption {
  id: string;
  nombre: string | null;
  email: string | null;
}

export interface UpdateCcStatusRequest {
  ccActivo: boolean;
  ccRol?: "agente" | "supervisor";
  ccMaxPedidos?: number;
}

export async function getAgentesCC(
  storeId: string | string[],
  companyId?: string,
  signal?: AbortSignal,
): Promise<AgenteConKpis[]> {
  if (Array.isArray(storeId)) {
    const results = await Promise.all([...new Set(storeId)].map((id) => getAgentesCC(id, companyId, signal)));
    const agents = new Map<string, AgenteConKpis>();
    for (const result of results) for (const agent of result) {
      const previous = agents.get(agent.id);
      if (!previous) { agents.set(agent.id, { ...agent }); continue; }
      for (const key of ["pedidosPendientes", "gestionadosHoy", "cierresHoy", "totalAsignados", "totalConfirmados", "productosVendidos"] as const) previous[key] += Number(agent[key] ?? 0);
      previous.tasaCierre = previous.totalAsignados > 0 ? Math.round(100 * previous.totalConfirmados / previous.totalAsignados) : 0;
    }
    return [...agents.values()];
  }
  const params = new URLSearchParams({ storeId });
  if (companyId) params.append("companyId", companyId);
  const res = await axiosAuth.get<AgenteConKpis[]>(
    `${BASE_VENTAS}/atencion-al-cliente/agentes?${params.toString()}`,
    { signal },
  );
  return res.data;
}

export async function toggleMiCcStatus(
  accessToken: string,
  body: UpdateCcStatusRequest,
): Promise<void> {
  await axios.patch(`${API_AUTH}/api/v1/auth/users/cc-status`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function toggleAgenteCcStatus(
  accessToken: string,
  targetId: string,
  body: UpdateCcStatusRequest,
): Promise<void> {
  await axios.patch(
    `${API_AUTH}/api/v1/auth/users/${targetId}/cc-status`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function getAgentesPerformance(
  scope: string | string[],
  companyId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<AgentePerformanceKpis[]> {
  if (Array.isArray(scope)) {
    const results = await Promise.all([...new Set(scope)].map((storeId) => getAgentesPerformance(storeId, companyId, startDate, endDate, signal)));
    const agents = new Map<string, AgentePerformanceKpis>();
    for (const result of results) for (const agent of result) {
      const previous = agents.get(agent.id);
      if (!previous) { agents.set(agent.id, { ...agent }); continue; }
      for (const key of ["asignados", "contactados", "confirmados", "entregados", "ventasConfirmadas", "unidades", "facturacionBase", "upsellMonto"] as const) previous[key] += Number(agent[key] ?? 0);
      previous.ticketPromedio = previous.confirmados > 0 ? previous.ventasConfirmadas / previous.confirmados : 0;
      previous.pctContactados = previous.asignados > 0 ? 100 * previous.contactados / previous.asignados : 0;
      previous.pctConfirmados = previous.asignados > 0 ? 100 * previous.confirmados / previous.asignados : 0;
      previous.pctEntregados = previous.confirmados > 0 ? 100 * previous.entregados / previous.confirmados : 0;
      previous.ticketFinal = previous.confirmados > 0 ? (previous.facturacionBase + previous.upsellMonto) / previous.confirmados : 0;
    }
    return [...agents.values()].sort((a, b) => b.ventasConfirmadas - a.ventasConfirmadas);
  }
  const params = new URLSearchParams({ storeId: scope, companyId, startDate, endDate });
  const res = await axiosAuth.get<AgentePerformanceKpis[]>(`${BASE_VENTAS}/atencion-al-cliente/agentes/kpis?${params.toString()}`, { signal });
  return res.data;
}

export async function getVendedores(companyId: string): Promise<VendedorOption[]> {
  const res = await axiosAuth.get<VendedorOption[]>(
    `${BASE_VENTAS}/atencion-al-cliente/agentes/vendedores?companyId=${companyId}`,
  );
  return res.data;
}
