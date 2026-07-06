"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGastos,
  getShrinkageSummary,
  getShrinkageList,
  getCourierCost,
} from "@/api/Admin";
import { getOrdersByCompany } from "@/api/Ventas";

const STALE = 5 * 60 * 1000; // 5 min

export function useAdminOrders(
  companyId: string,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-orders", companyId, fromDate, toDate],
    queryFn: () => getOrdersByCompany(companyId, fromDate, toDate),
    enabled: !!companyId && !!fromDate && !!toDate,
    staleTime: STALE,
  });
}

export function useAdminGastos(
  companyId: string,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-gastos", companyId, fromDate, toDate],
    queryFn: () => getGastos(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });
}

export function useAdminShrinkageSummary(
  companyId: string,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-shrinkage-summary", companyId, fromDate, toDate],
    queryFn: () => getShrinkageSummary(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });
}

export function useAdminShrinkageList(
  companyId: string,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-shrinkage-list", companyId, fromDate, toDate],
    queryFn: () => getShrinkageList(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });
}

export function useAdminCourierCost(
  storeIds: string[],
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ["admin-courier-cost", storeIds.join(","), fromDate, toDate],
    queryFn: () => getCourierCost(storeIds, fromDate, toDate),
    enabled: storeIds.length > 0,
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
