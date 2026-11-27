// FEAT-34 Fase 2: agregados de /administracion calculados en ms-ventas. La empresa sale del token, así que van
// siempre con la sesión (axiosAuth agrega el Bearer y lo renueva ante un 401); nunca con `axios` pelado.
import axios from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  CapitalNuevo,
  CapitalServidor,
  ComprasAdministracion,
  CuentaNueva,
  CuentaServidor,
  EnTransitoAdministracion,
  ImportacionLocal,
  MetasAdministracion,
  ObjetivosAdministracion,
  ResultadosAdministracion,
  ResumenImportacion,
} from "@/interfaces/IAdministracion";

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

// ── FEAT-34 Fase 3: lo que antes vivía en el navegador, ahora en ms-ventas (VIEW_FINANCES, empresa del token) ──

const BASE = () => `${API.ventas}/administracion`;

/** Metas del año (ventas, utilidad operativa, margen objetivo); null = sin meta. */
export const getMetasAdministracion = async (anio: number, signal?: AbortSignal): Promise<MetasAdministracion> => {
  const { data } = await axios.get<MetasAdministracion>(`${BASE()}/metas`, { params: { anio }, signal });
  return data;
};

/** Guarda las metas del año (null borra) y devuelve las vigentes. */
export const guardarMetasAdministracion = async (metas: MetasAdministracion): Promise<MetasAdministracion> => {
  const { data } = await axios.put<MetasAdministracion>(`${BASE()}/metas`, metas);
  return data;
};

export const getObjetivosAdministracion = async (signal?: AbortSignal): Promise<ObjetivosAdministracion> => {
  const { data } = await axios.get<ObjetivosAdministracion>(`${BASE()}/objetivos`, { signal });
  return data;
};

/** Objetivo de ventas por día de un canal (`claveCanal` o `todos`); null lo borra. Devuelve todos. */
export const guardarObjetivoAdministracion = async (
  canal: string,
  ventasDia: number | null,
): Promise<ObjetivosAdministracion> => {
  const { data } = await axios.put<ObjetivosAdministracion>(`${BASE()}/objetivos/${encodeURIComponent(canal)}`, {
    ventasDia,
  });
  return data;
};

export const getCapitalAdministracion = async (signal?: AbortSignal): Promise<{ entradas: CapitalServidor[] }> => {
  const { data } = await axios.get<{ entradas: CapitalServidor[] }>(`${BASE()}/capital`, { signal });
  return data;
};

export const crearCapital = async (nuevo: CapitalNuevo): Promise<CapitalServidor> => {
  const { data } = await axios.post<CapitalServidor>(`${BASE()}/capital`, nuevo);
  return data;
};

export const actualizarCapital = async (id: string, cambios: Partial<CapitalNuevo>): Promise<CapitalServidor> => {
  const { data } = await axios.patch<CapitalServidor>(`${BASE()}/capital/${encodeURIComponent(id)}`, cambios);
  return data;
};

export const borrarCapital = async (id: string): Promise<{ id: string }> => {
  const { data } = await axios.delete<{ id: string }>(`${BASE()}/capital/${encodeURIComponent(id)}`);
  return data;
};

export const getCuentasAdministracion = async (signal?: AbortSignal): Promise<{ cuentas: CuentaServidor[] }> => {
  const { data } = await axios.get<{ cuentas: CuentaServidor[] }>(`${BASE()}/cuentas`, { signal });
  return data;
};

export const crearCuenta = async (nueva: CuentaNueva): Promise<CuentaServidor> => {
  const { data } = await axios.post<CuentaServidor>(`${BASE()}/cuentas`, nueva);
  return data;
};

/** Cambia una cuenta: `saldadaEn` = día cobrado/pagado; null la reabre. */
export const actualizarCuenta = async (id: string, cambios: Partial<CuentaNueva>): Promise<CuentaServidor> => {
  const { data } = await axios.patch<CuentaServidor>(`${BASE()}/cuentas/${encodeURIComponent(id)}`, cambios);
  return data;
};

export const borrarCuenta = async (id: string): Promise<{ id: string }> => {
  const { data } = await axios.delete<{ id: string }>(`${BASE()}/cuentas/${encodeURIComponent(id)}`);
  return data;
};

/** Sube lo guardado en este navegador; cada tipo solo si el servidor no tiene nada de ese tipo. */
export const importarDatosLocales = async (datos: ImportacionLocal): Promise<ResumenImportacion> => {
  const { data } = await axios.post<ResumenImportacion>(`${BASE()}/importar-local`, datos);
  return data;
};

/** Compras de inventario pagadas en el periodo (por mes) y las pendientes de pago. */
export const getComprasAdministracion = async (
  fromDate: string,
  toDate: string,
  signal?: AbortSignal,
): Promise<ComprasAdministracion> => {
  const { data } = await axios.get<ComprasAdministracion>(`${BASE()}/compras`, { params: { fromDate, toDate }, signal });
  return data;
};
