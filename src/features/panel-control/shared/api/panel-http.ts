import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/**
 * GET a los endpoints `/panel/*` de ms-ventas. El token lo agrega axiosAuth; el
 * servidor decide el rol y la empresa con él, así que aquí solo viajan los filtros.
 */
export async function getPanel<T>(path: string, params: object): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
  const { data } = await axiosAuth.get<T>(`${base}/panel/${path}`, { params });
  return data;
}
