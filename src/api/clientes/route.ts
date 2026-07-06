import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

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

export async function createClient(data: CreateClientDto) {
  const res = await axiosAuth.post(`${GATEWAY.ventas}/clients`, data);
  return res;
}

export async function updateClient(id: string, data: UpdateClientDto) {
  const res = await axiosAuth.patch(`${GATEWAY.ventas}/clients/${id}`, data);
  return res;
}

export async function findByCompany(
  id: string,
  filters?: { brandId?: string; categoryId?: string }
) {
  const res = await axiosAuth.get(`${GATEWAY.ventas}/clients/company/${id}`, {
    params: filters,
  });
  return res;
}

export async function toggleClienteActivo(id: string) {
  const res = await axiosAuth.patch(`${GATEWAY.ventas}/clients/${id}/toggle`);
  return res;
}
