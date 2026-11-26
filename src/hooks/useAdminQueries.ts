"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGastos, getShrinkageSummary, getShrinkageList } from "@/api/Admin";

const STALE = 5 * 60 * 1000; // 5 min

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
