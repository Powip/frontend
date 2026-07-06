import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { CanalConfig } from "@/interfaces/IOrder";

export async function getCanales(empresaId: string): Promise<CanalConfig[]> {
  const res = await axiosAuth.get<CanalConfig[]>(`${GATEWAY.ventas}/config/canales?empresaId=${empresaId}`);
  return res.data;
}

export async function getCanalesDefaults(): Promise<CanalConfig[]> {
  const res = await axiosAuth.get<CanalConfig[]>(`${GATEWAY.ventas}/config/canales/defaults`);
  return res.data;
}

export async function updateCanal(
  id: string,
  data: Partial<Pick<CanalConfig, "flujoEntrada" | "datosRequeridos" | "activo">>,
): Promise<CanalConfig> {
  const res = await axiosAuth.put<CanalConfig>(`${GATEWAY.ventas}/config/canales/${id}`, data);
  return res.data;
}

export async function createCanal(data: Omit<CanalConfig, "id" | "empresaId"> & { empresaId?: string }): Promise<CanalConfig> {
  const res = await axiosAuth.post<CanalConfig>(`${GATEWAY.ventas}/config/canales`, data);
  return res.data;
}
