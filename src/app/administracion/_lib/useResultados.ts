"use client";

/**
 * Hooks de datos de Administración (FEAT-34). Todas las pestañas que muestran ventas, costos o utilidad salen de
 * acá, así que para el mismo periodo dan los mismos números.
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCourierCost, getGastos, getShrinkageList } from "@/api/Admin";
import { getOrdersByCompany } from "@/api/Ventas";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAdminCourierCost,
  useAdminGastos,
  useAdminOrders,
  useAdminShrinkageSummary,
} from "@/hooks/useAdminQueries";
import type { IGastoOperativo, IInventoryShrinkage } from "@/interfaces/IAdmin";
import {
  aDiaKey,
  type DiaKey,
  diaLima,
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
  delPeriodo,
  estaEnTransito,
  type PedidoAdmin,
  type ResumenVentas,
  resumirVentas,
  saldoPedido,
} from "./ventas";

const STALE = 5 * 60 * 1000;
// Vacíos estables: un `?? []` nuevo en cada render haría recalcular los useMemo mientras carga.
const SIN_PEDIDOS: PedidoAdmin[] = [];
const SIN_GASTOS: IGastoOperativo[] = [];
const SIN_MERMAS: IInventoryShrinkage[] = [];

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

export interface DatosPeriodo {
  desde: DiaKey;
  hasta: DiaKey;
  cargando: boolean;
  error: unknown;
  /** Pedidos creados en el periodo, de cualquier estado (sin leads). */
  pedidos: PedidoAdmin[];
  ventas: ResumenVentas;
  gastos: ProrrateoGastos;
  gastosCrudos: IGastoOperativo[];
  merma: { unidades: number; costo: number };
  envios: number;
  publicidad: PublicidadConectada;
  resultados: Resultados;
}

export function useResultadosPeriodo(desde: DiaKey, hasta: DiaKey): DatosPeriodo {
  const { companyId, token, storeIds, igvPct } = useAdminContexto();
  const pedidosQ = useAdminOrders(companyId, desde, hasta);
  const gastosQ = useAdminGastos(companyId, desde, hasta, token);
  const mermaQ = useAdminShrinkageSummary(companyId, desde, hasta, token);
  const enviosQ = useAdminCourierCost(storeIds, desde, hasta, token);
  const publicidad = usePublicidadConectada(desde, hasta);

  const pedidos = pedidosQ.data ?? SIN_PEDIDOS;
  const gastosCrudos = gastosQ.data ?? SIN_GASTOS;
  const mermaData = mermaQ.data;
  const envios = Number(enviosQ.data ?? 0);

  const calculado = useMemo(() => {
    const ventas = resumirVentas(pedidos);
    const gastos = prorratearGastos(gastosCrudos, desde, hasta);
    const merma = { unidades: Number(mermaData?.totalUnidades ?? 0), costo: Number(mermaData?.costoEstimado ?? 0) };
    const resultados = calcularResultados({
      ventas,
      gastos,
      merma: merma.costo,
      envios,
      publicidadConectada: publicidad.monto,
      igvPct,
    });
    return { ventas, gastos, merma, resultados };
  }, [pedidos, gastosCrudos, mermaData, envios, publicidad.monto, igvPct, desde, hasta]);

  return {
    desde,
    hasta,
    cargando: pedidosQ.isLoading || gastosQ.isLoading || mermaQ.isLoading || enviosQ.isLoading,
    error: pedidosQ.error ?? gastosQ.error ?? null,
    pedidos,
    gastosCrudos,
    envios,
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
 */
export function useResultadosAnuales(anio: number, opciones: { hastaDia?: DiaKey } = {}) {
  const { companyId, token, storeIds, igvPct, hoy } = useAdminContexto();
  const desde = aDiaKey(anio, 1, 1);
  const hasta = minDia(aDiaKey(anio, 12, 31), opciones.hastaDia ?? hoy);
  const valido = hasta >= desde;

  const pedidosQ = useQuery({
    queryKey: ["admin-anual-pedidos", companyId, desde, hasta],
    queryFn: async () =>
      delPeriodo(
        (await getOrdersByCompany(companyId, desde, sumarDias(hasta, 1))) as PedidoAdmin[],
        desde,
        hasta,
      ),
    enabled: !!companyId && valido,
    staleTime: STALE,
  });
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
  const rangos = Array.from({ length: 12 }, (_, i) => (valido ? rangoMesDentro(anio, i + 1, desde, hasta) : null));
  const enviosQs = useQueries({
    queries: rangos.map((rango, i) => ({
      queryKey: ["admin-month-courier", storeIds.join(","), anio, i + 1, rango?.hasta ?? null],
      queryFn: () => (rango ? getCourierCost(storeIds, rango.desde, rango.hasta, token) : Promise.resolve(0)),
      enabled: storeIds.length > 0 && !!token && !!rango,
      staleTime: STALE,
    })),
  });
  const publicidad = usePublicidadConectada(desde, valido ? hasta : desde);

  const pedidos = pedidosQ.data ?? SIN_PEDIDOS;
  const gastos = gastosQ.data ?? SIN_GASTOS;
  const mermas = mermaQ.data ?? SIN_MERMAS;
  const enviosPorMes = enviosQs.map((q) => Number(q.data ?? 0));
  const enviosClave = enviosPorMes.join(",");

  const calculado = useMemo(() => {
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
      const delMes = rango ? delPeriodo(pedidos, rango.desde, rango.hasta) : [];
      const prorrateo = rango ? prorratearGastos(gastos, rango.desde, rango.hasta) : prorratearGastos([], desde, desde);
      const resultados = calcularResultados({
        ventas: resumirVentas(delMes),
        gastos: prorrateo,
        merma: mermaPorMes.get(clave) ?? 0,
        envios: rango ? enviosPorMes[i] : 0,
        publicidadConectada: rango ? (publicidadMes.get(clave) ?? (conDato ? 0 : null)) : 0,
        igvPct,
      });
      return {
        anio,
        mes,
        rango,
        resultados,
        tieneDatos: !!rango && (delMes.length > 0 || prorrateo.filas.length > 0),
      };
    });
    const total = calcularResultados({
      ventas: resumirVentas(pedidos),
      gastos: valido ? prorratearGastos(gastos, desde, hasta) : prorratearGastos([], desde, desde),
      merma: [...mermaPorMes.values()].reduce((s, v) => s + v, 0),
      envios: enviosPorMes.reduce((s, v) => s + v, 0),
      publicidadConectada: publicidad.monto,
      igvPct,
    });
    return { meses, total };
    // `rangos` se deriva de anio/desde/hasta; `enviosClave` resume los 12 resultados de courier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, gastos, mermas, enviosClave, publicidad.porDia, publicidad.estado, publicidad.monto, igvPct, anio, desde, hasta, valido]);

  return {
    anio,
    desde,
    hasta,
    cargando:
      pedidosQ.isLoading || gastosQ.isLoading || mermaQ.isLoading || enviosQs.some((q) => q.isLoading),
    error: pedidosQ.error ?? gastosQ.error ?? null,
    pedidos,
    gastosCrudos: gastos,
    publicidad,
    ...calculado,
  };
}

/** Ventana de «en tránsito»: el saldo en calle es una foto de hoy, no depende del periodo elegido. */
export const DIAS_EN_TRANSITO = 90;

/**
 * Pedidos que hoy están en calle (ASIGNADO_A_GUIA, EN_ENVIO o DESPACHADO), creados en los últimos 90 días. Antes solo
 * se contaba DESPACHADO (~25 % del saldo real, FEAT-34 C7).
 */
export function usePedidosEnTransito() {
  const { companyId, hoy } = useAdminContexto();
  const desde = sumarDias(hoy, -(DIAS_EN_TRANSITO - 1));
  const q = useAdminOrders(companyId, desde, hoy);
  const pedidos = useMemo(() => (q.data ?? SIN_PEDIDOS).filter(estaEnTransito), [q.data]);
  const saldo = useMemo(
    () => pedidos.reduce((s, p) => s + saldoPedido(p), 0),
    [pedidos],
  );
  return { cargando: q.isLoading, error: q.error, pedidos, saldo, desde, hasta: hoy };
}
