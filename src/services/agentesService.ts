import axiosAuth from "@/lib/axiosAuth";
import { AgenteConKpis, AgentePerformanceKpis } from "@/interfaces/IOrder";
import { GATEWAY } from "@/lib/gateway";

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
  storeId: string,
  companyId?: string,
): Promise<AgenteConKpis[]> {
  const params = new URLSearchParams({ storeId });
  if (companyId) params.append("companyId", companyId);
  const res = await axiosAuth.get<AgenteConKpis[]>(
    `${GATEWAY.ventas}/atencion-al-cliente/agentes?${params.toString()}`,
  );
  return res.data;
}

export async function toggleMiCcStatus(
  body: UpdateCcStatusRequest,
): Promise<void> {
  await axiosAuth.patch(`${GATEWAY.auth}/api/v1/auth/users/cc-status`, body);
}

export async function toggleAgenteCcStatus(
  targetId: string,
  body: UpdateCcStatusRequest,
): Promise<void> {
  await axiosAuth.patch(
    `${GATEWAY.auth}/api/v1/auth/users/${targetId}/cc-status`,
    body,
  );
}

export async function getAgentesPerformance(
  storeId: string,
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<AgentePerformanceKpis[]> {
  const params = new URLSearchParams({ storeId, companyId, startDate, endDate });
  const res = await axiosAuth.get<AgentePerformanceKpis[]>(
    `${GATEWAY.ventas}/atencion-al-cliente/agentes/kpis?${params.toString()}`,
  );
  return res.data;
}

export async function getVendedores(companyId: string): Promise<VendedorOption[]> {
  const res = await axiosAuth.get<VendedorOption[]>(
    `${GATEWAY.ventas}/atencion-al-cliente/agentes/vendedores?companyId=${companyId}`,
  );
  return res.data;
}
