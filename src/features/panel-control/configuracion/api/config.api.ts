import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  ComisionRegla,
  ConfigComisiones,
  ConfigCouriers,
  ConfigFichaGuardar,
  ConfigGastosFijos,
  ConfigMetas,
  ConfigMetasGuardar,
  CourierConfigGuardar,
  GastoFijo,
} from "../models/configuracion.model";

/**
 * Endpoints `/config/*` de ms-ventas (solo Dueño). La empresa y el usuario salen del token:
 * ninguna de estas peticiones lleva `empresaId` (el backend responde 400 si llega).
 */
function base(): string {
  return process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
}

export async function getConfigMetas(): Promise<ConfigMetas> {
  const { data } = await axiosAuth.get<ConfigMetas>(`${base()}/config/metas`);
  return data;
}

export async function putConfigMetas(cuerpo: ConfigMetasGuardar): Promise<ConfigMetas> {
  const { data } = await axiosAuth.put<ConfigMetas>(`${base()}/config/metas`, cuerpo);
  return data;
}

export async function getConfigComisiones(): Promise<ConfigComisiones> {
  const { data } = await axiosAuth.get<ConfigComisiones>(`${base()}/config/comisiones`);
  return data;
}

export async function putConfigComisiones(reglas: ComisionRegla[]): Promise<ConfigComisiones> {
  const { data } = await axiosAuth.put<ConfigComisiones>(`${base()}/config/comisiones`, {
    reglas,
  });
  return data;
}

export async function getConfigGastosFijos(): Promise<ConfigGastosFijos> {
  const { data } = await axiosAuth.get<ConfigGastosFijos>(`${base()}/config/gastos-fijos`);
  return data;
}

export async function putConfigGastosFijos(gastos: GastoFijo[]): Promise<ConfigGastosFijos> {
  const { data } = await axiosAuth.put<ConfigGastosFijos>(`${base()}/config/gastos-fijos`, {
    gastos,
  });
  return data;
}

export async function getConfigCouriers(): Promise<ConfigCouriers> {
  const { data } = await axiosAuth.get<ConfigCouriers>(`${base()}/config/couriers`);
  return data;
}

export async function putConfigCouriers(couriers: CourierConfigGuardar[]): Promise<ConfigCouriers> {
  const { data } = await axiosAuth.put<ConfigCouriers>(`${base()}/config/couriers`, {
    couriers,
  });
  return data;
}

/** `PUT /config/canales/:id/ficha` (no confundir con `PUT /config/canales/:id`, el de la pantalla vieja). */
export async function putFichaCanal(
  canalId: string,
  ficha: ConfigFichaGuardar,
): Promise<{ id: string } & ConfigFichaGuardar> {
  const { data } = await axiosAuth.put<{ id: string } & ConfigFichaGuardar>(
    `${base()}/config/canales/${canalId}/ficha`,
    ficha,
  );
  return data;
}
