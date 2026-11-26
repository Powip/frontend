// FEAT-34 Fase 2: agregados de /administracion calculados en ms-ventas. La empresa sale del token, así que van
// siempre con la sesión (axiosAuth agrega el Bearer y lo renueva ante un 401); nunca con `axios` pelado.
import axios from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type { EnTransitoAdministracion, ResultadosAdministracion } from "@/interfaces/IAdministracion";

/** Ventas entregadas entre dos días de Lima (por fecha de ENTREGA), con totales, por día, canal y producto. */
export const getResultadosAdministracion = async (
  fromDate: string,
  toDate: string,
  signal?: AbortSignal,
): Promise<ResultadosAdministracion> => {
  const { data } = await axios.get<ResultadosAdministracion>(`${API.ventas}/administracion/resultados`, {
    params: { fromDate, toDate },
    signal,
  });
  return data;
};

/** Foto de hoy de los pedidos en la calle (últimos 90 días) y lo que falta cobrar de ellos. */
export const getEnTransitoAdministracion = async (signal?: AbortSignal): Promise<EnTransitoAdministracion> => {
  const { data } = await axios.get<EnTransitoAdministracion>(`${API.ventas}/administracion/en-transito`, { signal });
  return data;
};
