"use client";

/**
 * Agregado mes-a-mes real para Flujo de Caja y Resumen Anual.
 *
 * Simplificación deliberada frente a `calcularPnL` (resumen/page.tsx): NO
 * incluye merma, comisión POWIP ni IGV/IR estimado por mes (habría que sumar
 * 12 llamadas más a `getShrinkageSummary` por página). Solo ventas − COGS −
 * gastos operativos − costo de courier. Ver el informe de conexión de datos
 * para el detalle de qué falta por pestaña.
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { getOrdersByCompany } from "@/api/Ventas";
import { getCourierCost, getGastos } from "@/api/Admin";
import { soloEntregados, fechaOrden } from "./realData";

const STALE = 5 * 60 * 1000;

export interface MesPnlReal {
  mes: number; // 1-12
  anio: number;
  ventas: number;
  cogs: number;
  unidades: number;
  gastosFijos: number;
  courierCost: number;
  utilidadBrutaPct: number;
  profit: number;
  margenNetoPct: number | null;
  tieneDatos: boolean;
}

function rangoMes(anio: number, mes: number) {
  const mm = String(mes).padStart(2, "0");
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { from: `${anio}-${mm}-01`, to: `${anio}-${mm}-${ultimoDia}` };
}

export function useAdminYearPnl(companyId: string, anio: number, storeIds: string[], token: string) {
  const fromDate = `${anio}-01-01`;
  const toDate = `${anio}-12-31`;

  const ordersQ = useQuery({
    queryKey: ["admin-year-orders", companyId, anio],
    queryFn: () => getOrdersByCompany(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const gastosQ = useQuery({
    queryKey: ["admin-year-gastos", companyId, anio],
    queryFn: () => getGastos(companyId, fromDate, toDate, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });

  const courierQs = useQueries({
    queries: Array.from({ length: 12 }, (_, i) => {
      const { from, to } = rangoMes(anio, i + 1);
      return {
        queryKey: ["admin-month-courier", storeIds.join(","), anio, i + 1],
        queryFn: () => getCourierCost(storeIds, from, to, token),
        enabled: storeIds.length > 0 && !!token,
        staleTime: STALE,
      };
    }),
  });

  const isLoading = ordersQ.isLoading || gastosQ.isLoading || courierQs.some((q) => q.isLoading);

  const orders = (ordersQ.data ?? []) as any[];
  const gastos = (gastosQ.data ?? []) as any[];

  const meses: MesPnlReal[] = Array.from({ length: 12 }, (_, i) => {
    const mesNum = i + 1;
    const entregadasMes = soloEntregados(orders).filter((o) => {
      const f = fechaOrden(o);
      return f.getMonth() + 1 === mesNum && f.getFullYear() === anio;
    });
    const ventas = entregadasMes.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    const cogs = entregadasMes.reduce((s, o) => s + Number(o.costAmount || 0), 0);
    const unidades = entregadasMes.reduce((s, o) => s + (o.itemCount || (Array.isArray(o.items) ? o.items.length : 1)), 0);
    const gastosMes = gastos.filter((g) => g.mes === mesNum && g.anio === anio);
    const gastosFijos = gastosMes.reduce((s, g) => s + Number(g.monto || 0), 0);
    const courierCost = Number(courierQs[i]?.data ?? 0);
    const utilidadBruta = ventas - cogs;
    const utilidadBrutaPct = ventas > 0 ? (utilidadBruta / ventas) * 100 : 0;
    const profit = utilidadBruta - gastosFijos - courierCost;
    const margenNetoPct = ventas > 0 ? (profit / ventas) * 100 : null;
    return {
      mes: mesNum,
      anio,
      ventas,
      cogs,
      unidades,
      gastosFijos,
      courierCost,
      utilidadBrutaPct,
      profit,
      margenNetoPct,
      tieneDatos: entregadasMes.length > 0 || gastosMes.length > 0,
    };
  });

  return { meses, isLoading, ordersRaw: orders, gastosRaw: gastos };
}
