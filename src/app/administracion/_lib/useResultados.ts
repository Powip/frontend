"use client";

/**
 * Hooks de datos de Administración (FEAT-34). Todas las pestañas que muestran ventas, costos o utilidad salen de
 * acá, así que para el mismo periodo dan los mismos números.
 *
 * Fase 2: las ventas llegan ya calculadas de ms-ventas (`/administracion/resultados`, por fecha de ENTREGA) y el
 * saldo en calle de `/administracion/en-transito`. El front ya no baja pedidos crudos ni pide la cotización de
 * guías a ms-courier: los envíos son el flete por pedido que trae el servidor (D9).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getGastos, getShrinkageList } from "@/api/Admin";
import { getEnTransitoAdministracion, getResultadosAdministracion } from "@/api/Administracion";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminGastos, useAdminShrinkageSummary } from "@/hooks/useAdminQueries";
import type { IGastoOperativo, IInventoryShrinkage } from "@/interfaces/IAdmin";
import {
  ESTADOS_EN_TRANSITO,
  type CourierEnTransito,
  type EstadoEnTransito,
  type ResultadosAdministracion,
  type SaldoEnTransito,
} from "@/interfaces/IAdministracion";
import {
  aDiaKey,
  type DiaKey,
  diaLima,
  diasEntre,
  esDiaKey,
  hoyLima,
  minDia,
  periodoAnterior,
  sumarDias,
} from "./periodo";
import { consumoPorMes, type PublicidadConectada, usePublicidadConectada } from "./publicidad";
import {
  calcularResultados,
  type ProrrateoGastos,
  prorratearGastos,
  type Resultados,
  rangoMesDentro,
} from "./resultados";
import {
  agregadosPorMes,
  agregadoVacio,
  type CoberturaFlete,
  coberturaFlete,
  resultadosVacios,
  resumenDeAgregado,
} from "./servidor";
import type { ResumenVentas } from "./ventas";

const STALE = 5 * 60 * 1000;
// Vacíos estables: un `?? []` nuevo en cada render haría recalcular los useMemo mientras carga.
const SIN_GASTOS: IGastoOperativo[] = [];
const SIN_MERMAS: IInventoryShrinkage[] = [];

/** Rango máximo que acepta `/administracion/resultados` (días contando las dos puntas). */
export const MAX_DIAS_RESULTADOS = 400;

export function useAdminContexto() {
  const { auth } = useAuth();
  const stores = auth?.company?.stores;
  const storeIds = useMemo(() => (stores ?? []).map((s) => s.id), [stores]);
  return {
    companyId: auth?.company?.id ?? "",
    token: auth?.accessToken ?? "",
    storeIds,
    /** Tasa de IGV de la empresa en %. */
    igvPct: auth?.company?.iva ?? 18,
    hoy: hoyLima(),
  };
}

/**
 * Ventas entregadas entre dos días de Lima, calculadas en ms-ventas. La empresa sale del token; el `companyId` de la
 * clave solo separa la caché si cambia la sesión. Un rango de más de 400 días no se pide: devuelve un error para
 * mostrar en pantalla.
 */
export function useVentasServidor(desde: DiaKey, hasta: DiaKey) {
  const { companyId } = useAdminContexto();
  const rangoValido = esDiaKey(desde) && esDiaKey(hasta) && desde <= hasta;
  const muyLargo = rangoValido && diasEntre(desde, hasta) > MAX_DIAS_RESULTADOS;
  const q = useQuery({
    queryKey: ["admin-resultados", companyId, desde, hasta],
    queryFn: ({ signal }) => getResultadosAdministracion(desde, hasta, signal),
    enabled: !!companyId && rangoValido && !muyLargo,
    staleTime: STALE,
  });
  const errorRango = useMemo(
    () => (muyLargo ? new Error(`El periodo es muy largo: elige uno de hasta ${MAX_DIAS_RESULTADOS} días.`) : null),
    [muyLargo],
  );
  const error = errorRango ?? q.error;
  return { data: q.data, isLoading: q.isLoading, isError: !!error, error };
}

export interface DatosPeriodo {
  desde: DiaKey;
  hasta: DiaKey;
  cargando: boolean;
  error: unknown;
  /** Respuesta de `/administracion/resultados` (vacía mientras carga). */
  servidor: ResultadosAdministracion;
  ventas: ResumenVentas;
  gastos: ProrrateoGastos;
  gastosCrudos: IGastoOperativo[];
  merma: { unidades: number; costo: number };
  /** Flete por pedido de las entregas que lo tienen (D9). */
  envios: number;
  /** En cuántas entregas se conoce el flete. */
  flete: CoberturaFlete;
  publicidad: PublicidadConectada;
  resultados: Resultados;
}

export function useResultadosPeriodo(desde: DiaKey, hasta: DiaKey): DatosPeriodo {
  const { companyId, token, igvPct } = useAdminContexto();
  const ventasQ = useVentasServidor(desde, hasta);
  const gastosQ = useAdminGastos(companyId, desde, hasta, token);
  const mermaQ = useAdminShrinkageSummary(companyId, desde, hasta, token);
  const publicidad = usePublicidadConectada(desde, hasta);

  const vacio = useMemo(() => resultadosVacios(desde, hasta), [desde, hasta]);
  const servidor = ventasQ.data ?? vacio;
  const gastosCrudos = gastosQ.data ?? SIN_GASTOS;
  const mermaData = mermaQ.data;

  const calculado = useMemo(() => {
    const ventas = resumenDeAgregado(servidor.totales);
    const flete = coberturaFlete(servidor.totales);
    const gastos = prorratearGastos(gastosCrudos, desde, hasta);
    const merma = { unidades: Number(mermaData?.totalUnidades ?? 0), costo: Number(mermaData?.costoEstimado ?? 0) };
    const resultados = calcularResultados({
      ventas,
      gastos,
      merma: merma.costo,
      envios: flete.monto,
      publicidadConectada: publicidad.monto,
      igvPct,
    });
    return { ventas, flete, envios: flete.monto, gastos, merma, resultados };
  }, [servidor, gastosCrudos, mermaData, publicidad.monto, igvPct, desde, hasta]);

  return {
    desde,
    hasta,
    cargando: ventasQ.isLoading || gastosQ.isLoading || mermaQ.isLoading,
    error: ventasQ.error ?? gastosQ.error ?? null,
    servidor,
    gastosCrudos,
    publicidad,
    ...calculado,
  };
}

/** El periodo y el mismo tramo un mes antes (ver `periodoAnterior`). */
export function useResultadosComparados(desde: DiaKey, hasta: DiaKey) {
  const rangoAnterior = periodoAnterior(desde, hasta);
  const actual = useResultadosPeriodo(desde, hasta);
  const anterior = useResultadosPeriodo(rangoAnterior.desde, rangoAnterior.hasta);
  return { actual, anterior, rangoAnterior };
}

export interface ResultadoMes {
  anio: number;
  mes: number;
  /** Tramo del mes que se mide (el mes en curso llega hasta hoy). null = mes futuro. */
  rango: { desde: DiaKey; hasta: DiaKey } | null;
  resultados: Resultados;
  tieneDatos: boolean;
}

/**
 * Resultados mes a mes de un año. Los meses futuros quedan vacíos (no restan gastos cargados por adelantado) y el
 * mes en curso se mide hasta hoy. `hastaDia` corta antes (por ejemplo, el año anterior a la misma fecha).
 *
 * Una sola consulta de ventas por el año (del 1 de enero al último día medido, ≤ 366 días); los meses salen de
 * agrupar `porDia`. Los envíos de cada mes son el flete por pedido de sus entregas.
 */
export function useResultadosAnuales(anio: number, opciones: { hastaDia?: DiaKey } = {}) {
  const { companyId, token, igvPct, hoy } = useAdminContexto();
  const desde = aDiaKey(anio, 1, 1);
  const hasta = minDia(aDiaKey(anio, 12, 31), opciones.hastaDia ?? hoy);
  const valido = hasta >= desde;

  const ventasQ = useVentasServidor(desde, hasta);
  const gastosQ = useQuery({
    queryKey: ["admin-anual-gastos", companyId, desde, hasta],
    queryFn: () => getGastos(companyId, desde, hasta, token),
    enabled: !!companyId && !!token && valido,
    staleTime: STALE,
  });
  const mermaQ = useQuery({
    queryKey: ["admin-anual-merma", companyId, desde, hasta],
    queryFn: () => getShrinkageList(companyId, desde, hasta, token),
    enabled: !!companyId && !!token && valido,
    staleTime: STALE,
  });
  const publicidad = usePublicidadConectada(desde, valido ? hasta : desde);

  const vacio = useMemo(() => resultadosVacios(desde, valido ? hasta : desde), [desde, hasta, valido]);
  const servidor = ventasQ.data ?? vacio;
  const gastos = gastosQ.data ?? SIN_GASTOS;
  const mermas = mermaQ.data ?? SIN_MERMAS;

  const calculado = useMemo(() => {
    const rangos = Array.from({ length: 12 }, (_, i) => (valido ? rangoMesDentro(anio, i + 1, desde, hasta) : null));
    const ventasPorMes = agregadosPorMes(servidor.porDia);
    const publicidadMes = consumoPorMes(publicidad.porDia);
    const conDato = publicidad.estado === "ok" || publicidad.estado === "sin_cuentas";
    const mermaPorMes = new Map<string, number>();
    for (const m of mermas as IInventoryShrinkage[]) {
      const dia = diaLima(m.createdAt);
      if (!dia) continue;
      const clave = dia.slice(0, 7);
      const costo = Number(m.quantity) * Number(m.unitCost) - Number(m.recoveredAmount || 0);
      mermaPorMes.set(clave, (mermaPorMes.get(clave) ?? 0) + costo);
    }
    const meses: ResultadoMes[] = rangos.map((rango, i) => {
      const mes = i + 1;
      const clave = `${anio}-${String(mes).padStart(2, "0")}`;
      const delMes = (rango && ventasPorMes.get(clave)) || agregadoVacio();
      const prorrateo = rango ? prorratearGastos(gastos, rango.desde, rango.hasta) : prorratearGastos([], desde, desde);
      const resultados = calcularResultados({
        ventas: resumenDeAgregado(delMes),
        gastos: prorrateo,
        merma: mermaPorMes.get(clave) ?? 0,
        envios: delMes.flete.monto,
        publicidadConectada: rango ? (publicidadMes.get(clave) ?? (conDato ? 0 : null)) : 0,
        igvPct,
      });
      return {
        anio,
        mes,
        rango,
        resultados,
        tieneDatos: !!rango && (delMes.pedidos > 0 || prorrateo.filas.length > 0),
      };
    });
    const total = calcularResultados({
      ventas: resumenDeAgregado(servidor.totales),
      gastos: valido ? prorratearGastos(gastos, desde, hasta) : prorratearGastos([], desde, desde),
      merma: [...mermaPorMes.values()].reduce((s, v) => s + v, 0),
      envios: servidor.totales.flete.monto,
      publicidadConectada: publicidad.monto,
      igvPct,
    });
    return { meses, total, flete: coberturaFlete(servidor.totales) };
  }, [servidor, gastos, mermas, publicidad.porDia, publicidad.estado, publicidad.monto, igvPct, anio, desde, hasta, valido]);

  return {
    anio,
    desde,
    hasta,
    cargando: ventasQ.isLoading || gastosQ.isLoading || mermaQ.isLoading,
    error: ventasQ.error ?? gastosQ.error ?? null,
    servidor,
    gastosCrudos: gastos,
    publicidad,
    ...calculado,
  };
}

/** Ventana de «en tránsito»: el saldo en calle es una foto de hoy, no depende del periodo elegido. */
export const DIAS_EN_TRANSITO = 90;

const POR_ESTADO_VACIO = Object.fromEntries(
  ESTADOS_EN_TRANSITO.map((estado) => [estado, { pedidos: 0, saldo: 0 }]),
) as Record<EstadoEnTransito, SaldoEnTransito>;
const SIN_COURIERS: CourierEnTransito[] = [];
const SIN_ANTIGUOS = { dias: 30, pedidos: 0, saldo: 0 };

export interface EnTransito {
  cargando: boolean;
  error: unknown;
  desde: DiaKey;
  hasta: DiaKey;
  /** Pedidos en la calle. */
  pedidos: number;
  /** Lo que falta cobrar de ellos (lo pagado por adelantado no suma). */
  saldo: number;
  porEstado: Record<EstadoEnTransito, SaldoEnTransito>;
  /** Por courier tal como está guardado (sin agrupar grafías). */
  porCourier: CourierEnTransito[];
  /** Los que llevan más de `dias` en la calle desde que se crearon. */
  antiguos: { dias: number; pedidos: number; saldo: number };
}

/**
 * Pedidos que hoy están en calle (ASIGNADO_A_GUIA, EN_ENVIO o DESPACHADO), creados en los últimos 90 días, y su saldo
 * (`/administracion/en-transito`). Antes solo se contaba DESPACHADO (~25 % del saldo real, FEAT-34 C7).
 */
export function usePedidosEnTransito(): EnTransito {
  const { companyId, hoy } = useAdminContexto();
  const q = useQuery({
    queryKey: ["admin-en-transito", companyId],
    queryFn: ({ signal }) => getEnTransitoAdministracion(signal),
    enabled: !!companyId,
    staleTime: STALE,
  });
  const datos = q.data;
  return {
    cargando: q.isLoading,
    error: q.error,
    desde: datos?.desde ?? sumarDias(hoy, -(DIAS_EN_TRANSITO - 1)),
    hasta: datos?.hoy ?? hoy,
    pedidos: datos?.pedidos ?? 0,
    saldo: datos?.saldo ?? 0,
    porEstado: datos?.porEstado ?? POR_ESTADO_VACIO,
    porCourier: datos?.porCourier ?? SIN_COURIERS,
    antiguos: datos?.antiguos ?? SIN_ANTIGUOS,
  };
}
