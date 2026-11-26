"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGastos,
  getShrinkageSummary,
  getShrinkageList,
  getCourierCost,
} from "@/api/Admin";
import { getOrdersByCompany } from "@/api/Ventas";
import { esDiaKey, sumarDias } from "@/app/administracion/_lib/periodo";
import { delPeriodo, type PedidoAdmin } from "@/app/administracion/_lib/ventas";

const STALE = 5 * 60 * 1000; // 5 min

/**
 * Pedidos de la empresa creados entre dos días de Lima (cualquier estado, sin leads).
 *
 * `order-header/company` filtra por día UTC (`T00:00:00` del servidor): en Lima pierde lo creado de 19:00 a 23:59 del
 * último día y suma la noche anterior al primero. Se pide un día más y se recorta acá por día de Lima (FEAT-34).
 */
export function useAdminOrders(
  companyId: string,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-orders", companyId, fromDate, toDate],
    queryFn: async (): Promise<PedidoAdmin[]> => {
      const pedidos = (await getOrdersByCompany(companyId, fromDate, sumarDias(toDate, 1))) as PedidoAdmin[];
      return delPeriodo(pedidos, fromDate, toDate);
    },
    enabled: !!companyId && esDiaKey(fromDate) && esDiaKey(toDate),
    staleTime: STALE,
  });
}

export function useAdminGastos(
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
) {
  return useQuery({
    queryKey: ["admin-gastos", companyId, fromDate, toDate],
    queryFn: () => getGastos(companyId, fromDate, toDate, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });
}

export function useAdminShrinkageSummary(
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
) {
  return useQuery({
    queryKey: ["admin-shrinkage-summary", companyId, fromDate, toDate],
    queryFn: () => getShrinkageSummary(companyId, fromDate, toDate, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });
}

export function useAdminShrinkageList(
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
) {
  return useQuery({
    queryKey: ["admin-shrinkage-list", companyId, fromDate, toDate],
    queryFn: () => getShrinkageList(companyId, fromDate, toDate, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });
}

export function useAdminCourierCost(
  storeIds: string[],
  fromDate: string,
  toDate: string,
  token: string,
) {
  return useQuery({
    queryKey: ["admin-courier-cost", storeIds.join(","), fromDate, toDate],
    queryFn: () => getCourierCost(storeIds, fromDate, toDate, token),
    enabled: storeIds.length > 0 && !!token,
    staleTime: STALE,
  });
}

export function useInvalidateAdminQueries() {
  const qc = useQueryClient();
  return (companyId: string, fromDate: string, toDate: string) => {
    qc.invalidateQueries({
      queryKey: ["admin-shrinkage-list", companyId, fromDate, toDate],
    });
    qc.invalidateQueries({
      queryKey: ["admin-shrinkage-summary", companyId, fromDate, toDate],
    });
  };
}
