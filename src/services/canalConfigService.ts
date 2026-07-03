import axios from "axios";
import { CanalConfig } from "@/interfaces/IOrder";

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export async function getCanales(empresaId: string): Promise<CanalConfig[]> {
  const res = await axios.get<CanalConfig[]>(`${BASE}/config/canales?empresaId=${empresaId}`);
  return res.data;
}

export async function getCanalesDefaults(): Promise<CanalConfig[]> {
  const res = await axios.get<CanalConfig[]>(`${BASE}/config/canales/defaults`);
  return res.data;
}

export async function updateCanal(
  id: string,
  data: Partial<Pick<CanalConfig, "flujoEntrada" | "datosRequeridos" | "activo">>,
): Promise<CanalConfig> {
  const res = await axios.put<CanalConfig>(`${BASE}/config/canales/${id}`, data);
  return res.data;
}

export async function createCanal(data: Omit<CanalConfig, "id" | "empresaId"> & { empresaId?: string }): Promise<CanalConfig> {
  const res = await axios.post<CanalConfig>(`${BASE}/config/canales`, data);
  return res.data;
}
