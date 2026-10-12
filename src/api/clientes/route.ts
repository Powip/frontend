import axiosAuth from "@/lib/axiosAuth";
import type { Client } from "@/interfaces/ICliente";
import { GATEWAY } from "@/lib/gateway";

const VENTAS_API = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;

interface CreateClientDto {
  companyId: string;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
}
interface UpdateClientDto extends Partial<CreateClientDto> {
  id: string;
}
export function createClient(data: CreateClientDto) {
  return axiosAuth.post(`${VENTAS_API}/clients`, data);
}

export function updateClient(id: string, data: UpdateClientDto) {
  return axiosAuth.patch(`${VENTAS_API}/clients/${id}`, data);
}

export function findByCompany(
  id: string,
  filters?: { brandId?: string; categoryId?: string },
  signal?: AbortSignal,
) {
  return axiosAuth.get<Client[]>(`${VENTAS_API}/clients/company/${id}`, { params: filters, signal });
}

export function toggleClienteActivo(id: string) {
  return axiosAuth.patch(`${VENTAS_API}/clients/${id}/toggle`);
}
