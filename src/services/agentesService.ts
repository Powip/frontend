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
  storeId: string,
  companyId?: string,
): Promise<AgenteConKpis[]> {
  const params = new URLSearchParams({ storeId });
  if (companyId) params.append("companyId", companyId);
  const res = await axiosAuth.get<AgenteConKpis[]>(
    `${BASE_VENTAS}/atencion-al-cliente/agentes?${params.toString()}`,
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
  storeId: string,
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<AgentePerformanceKpis[]> {
  const params = new URLSearchParams({ storeId, companyId, startDate, endDate });
  const res = await axiosAuth.get<AgentePerformanceKpis[]>(
    `${BASE_VENTAS}/atencion-al-cliente/agentes/kpis?${params.toString()}`,
  );
  return res.data;
}

export async function getVendedores(companyId: string): Promise<VendedorOption[]> {
  const res = await axiosAuth.get<VendedorOption[]>(
    `${BASE_VENTAS}/atencion-al-cliente/agentes/vendedores?companyId=${companyId}`,
  );
  return res.data;
}
