"use client";

/**
 * Datos de Administración guardados en ms-ventas (FEAT-34 Fase 3): metas, objetivos por canal, capital, cuentas y las
 * compras de inventario. Antes metas, objetivos, capital y cuentas vivían en el localStorage de cada navegador; ahora
 * los ve todo el equipo. Lo que haya quedado en un navegador se sube una vez con `ImportarNavegador` (layout).
 *
 * La empresa sale del token: el `companyId` de las claves solo separa la caché si cambia la sesión.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actualizarCapital,
  actualizarCuenta,
  borrarCapital,
  borrarCuenta,
  crearCapital,
  crearCuenta,
  getCapitalAdministracion,
  getComprasAdministracion,
  getCuentasAdministracion,
  getMetasAdministracion,
  getObjetivosAdministracion,
  guardarMetasAdministracion,
  guardarObjetivoAdministracion,
} from "@/api/Administracion";
import { useAuth } from "@/contexts/AuthContext";
import type {
  CapitalNuevo,
  CapitalServidor,
  ComprasAdministracion,
  CuentaNueva,
  CuentaServidor,
  MetasAdministracion,
  ObjetivosAdministracion,
} from "@/interfaces/IAdministracion";
import { type DiaKey, diasEntre, esDiaKey, minDia } from "./periodo";

const STALE = 5 * 60 * 1000;
/** Rango máximo de `/administracion/compras` (igual que Resultados). */
const MAX_DIAS_COMPRAS = 400;

export const CLAVES_ADMIN = {
  metas: (companyId: string, anio: number) => ["admin-metas", companyId, anio] as const,
  objetivos: (companyId: string) => ["admin-objetivos", companyId] as const,
  capital: (companyId: string) => ["admin-capital", companyId] as const,
  cuentas: (companyId: string) => ["admin-cuentas", companyId] as const,
  compras: (companyId: string, desde: string, hasta: string) => ["admin-compras", companyId, desde, hasta] as const,
};

function useEmpresa() {
  const { auth } = useAuth();
  return { companyId: auth?.company?.id ?? "", listo: !!auth?.accessToken && !!auth?.company?.id };
}

/** Texto del error del servidor (`message` de NestJS, string o lista) o el de por defecto. */
export function mensajeError(error: unknown, porDefecto: string): string {
  const mensaje = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const lista = (Array.isArray(mensaje) ? mensaje : [mensaje]).filter(
    (m): m is string => typeof m === "string" && m.trim() !== "",
  );
  return lista.length ? lista.join(" · ") : porDefecto;
}

// ── Metas anuales ──

export function useMetasServidor(anio: number) {
  const { companyId, listo } = useEmpresa();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CLAVES_ADMIN.metas(companyId, anio),
    queryFn: ({ signal }) => getMetasAdministracion(anio, signal),
    enabled: listo && anio >= 2000 && anio <= 2100,
    staleTime: STALE,
  });
  const guardar = useMutation({
    mutationFn: (metas: MetasAdministracion) => guardarMetasAdministracion(metas),
    onSuccess: (vigentes) => qc.setQueryData(CLAVES_ADMIN.metas(companyId, vigentes.anio), vigentes),
  });
  return { query, guardar };
}

// ── Objetivos diarios por canal ──

export function useObjetivosServidor() {
  const { companyId, listo } = useEmpresa();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CLAVES_ADMIN.objetivos(companyId),
    queryFn: ({ signal }) => getObjetivosAdministracion(signal),
    enabled: listo,
    staleTime: STALE,
  });
  const guardar = useMutation({
    mutationFn: ({ canal, ventasDia }: { canal: string; ventasDia: number | null }) =>
      guardarObjetivoAdministracion(canal, ventasDia),
    onSuccess: (vigentes: ObjetivosAdministracion) => qc.setQueryData(CLAVES_ADMIN.objetivos(companyId), vigentes),
  });
  return { query, guardar };
}

// ── Capital ──

export function useCapitalServidor() {
  const { companyId, listo } = useEmpresa();
  const qc = useQueryClient();
  const clave = CLAVES_ADMIN.capital(companyId);
  const query = useQuery({
    queryKey: clave,
    queryFn: async ({ signal }) => (await getCapitalAdministracion(signal)).entradas,
    enabled: listo,
    staleTime: STALE,
  });
  const reemplazar = (fila: CapitalServidor) =>
    qc.setQueryData<CapitalServidor[]>(clave, (prev) => (prev ?? []).map((c) => (c.id === fila.id ? fila : c)));
  const crear = useMutation({
    mutationFn: (nuevo: CapitalNuevo) => crearCapital(nuevo),
    onSuccess: (fila) => qc.setQueryData<CapitalServidor[]>(clave, (prev) => [...(prev ?? []), fila]),
  });
  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<CapitalNuevo> }) => actualizarCapital(id, cambios),
    onSuccess: reemplazar,
  });
  const borrar = useMutation({
    mutationFn: (id: string) => borrarCapital(id),
    onSuccess: ({ id }) => qc.setQueryData<CapitalServidor[]>(clave, (prev) => (prev ?? []).filter((c) => c.id !== id)),
  });
  return { query, crear, actualizar, borrar };
}

// ── Cuentas ──

export function useCuentasServidor() {
  const { companyId, listo } = useEmpresa();
  const qc = useQueryClient();
  const clave = CLAVES_ADMIN.cuentas(companyId);
  const query = useQuery({
    queryKey: clave,
    queryFn: async ({ signal }) => (await getCuentasAdministracion(signal)).cuentas,
    enabled: listo,
    staleTime: STALE,
  });
  const crear = useMutation({
    mutationFn: (nueva: CuentaNueva) => crearCuenta(nueva),
    onSuccess: (fila) => qc.setQueryData<CuentaServidor[]>(clave, (prev) => [...(prev ?? []), fila]),
  });
  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<CuentaNueva> }) => actualizarCuenta(id, cambios),
    onSuccess: (fila) =>
      qc.setQueryData<CuentaServidor[]>(clave, (prev) => (prev ?? []).map((c) => (c.id === fila.id ? fila : c))),
  });
  const borrar = useMutation({
    mutationFn: (id: string) => borrarCuenta(id),
    onSuccess: ({ id }) => qc.setQueryData<CuentaServidor[]>(clave, (prev) => (prev ?? []).filter((c) => c.id !== id)),
  });
  return { query, crear, actualizar, borrar };
}

// ── Compras de inventario ──

/**
 * Compras de inventario pagadas entre dos días de Lima (por mes) y las pendientes de pago. Un rango de más de 400 días
 * no se pide (error en pantalla).
 */
export function useComprasAdministracion(desde: string, hasta: string) {
  const { companyId, listo } = useEmpresa();
  const valido = esDiaKey(desde) && esDiaKey(hasta) && desde <= hasta;
  const largo = valido && diasEntre(desde as DiaKey, hasta as DiaKey) > MAX_DIAS_COMPRAS;
  const query = useQuery<ComprasAdministracion>({
    queryKey: CLAVES_ADMIN.compras(companyId, desde, hasta),
    queryFn: ({ signal }) => getComprasAdministracion(desde, hasta, signal),
    enabled: listo && valido && !largo,
    staleTime: STALE,
  });
  return {
    ...query,
    error: largo ? new Error(`El rango no puede superar ${MAX_DIAS_COMPRAS} días.`) : query.error,
  };
}

/** Compras del año, del 1 de enero hasta `hoy` (o el 31 de diciembre si el año ya terminó). */
export function useComprasDelAnio(anio: number, hoy: DiaKey) {
  const hasta = minDia(`${anio}-12-31` as DiaKey, hoy);
  return useComprasAdministracion(`${anio}-01-01`, hasta < `${anio}-01-01` ? `${anio}-01-01` : hasta);
}

/** Monto pagado por mes (1-12) de un año, para Flujo de caja y Gastos. */
export function comprasPorMesDelAnio(compras: ComprasAdministracion | undefined, anio: number): number[] {
  const meses = Array<number>(12).fill(0);
  for (const m of compras?.pagadas.porMes ?? []) {
    const [a, mes] = m.mes.split("-").map(Number);
    if (a === anio && mes >= 1 && mes <= 12) meses[mes - 1] += Number(m.monto) || 0;
  }
  return meses;
}
