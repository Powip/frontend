"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCouriers } from "@/services/courierService";
import type { Courier } from "@/services/courierService";

const EMPTY_COURIERS: Courier[] = [];

export function useCompanyCouriers(enabled = true) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const canFetch = enabled && Boolean(companyId && auth?.accessToken);
  const query = useQuery({
    queryKey: ["company-couriers", companyId, auth?.user?.id],
    queryFn: ({ signal }) => fetchCouriers(companyId!, {
      signal,
      accessToken: auth!.accessToken,
    }),
    enabled: canFetch,
    retry: false,
    staleTime: 30_000,
  });

  return {
    couriers: canFetch ? (query.data ?? EMPTY_COURIERS) : EMPTY_COURIERS,
    loading: canFetch && query.isPending,
    error: canFetch && query.isError,
    retry: query.refetch,
  };
}
