"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { Courier } from "@/services/courierService";

export function useMetricGuides<T extends { id: string }>() {
  const { auth } = useAuth();
  const { storeIds, canFetch } = useDashboardScope();
  const query = useQuery({
    queryKey: ["business-metric-guides", auth?.company?.id, auth?.user?.id, storeIds],
    enabled: canFetch,
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(storeIds.map((storeId) => axiosAuth.get<T[]>(
        `${process.env.NEXT_PUBLIC_API_COURIER || GATEWAY.courier}/shipping-guides/store/${storeId}`,
        { signal, headers: { Authorization: `Bearer ${auth!.accessToken}` } },
      )));
      return Array.from(new Map(responses.flatMap((response) => response.data).map((guide) => [guide.id, guide])).values());
    },
    retry: false,
    staleTime: 60_000,
  });
  return { guides: query.data ?? [], loading: query.isPending, error: query.isError, retry: query.refetch };
}

export function useMetricCouriers() {
  const { auth } = useAuth();
  const { canFetch } = useDashboardScope();
  const query = useQuery({
    queryKey: ["business-metric-couriers", auth?.company?.id, auth?.user?.id],
    enabled: canFetch && Boolean(auth?.company?.id),
    queryFn: async ({ signal }) => (await axiosAuth.get<Courier[]>(
      `${process.env.NEXT_PUBLIC_API_COURIER || GATEWAY.courier}/couriers/company/${auth!.company!.id}`,
      { signal, headers: { Authorization: `Bearer ${auth!.accessToken}` } },
    )).data,
    retry: false,
    staleTime: 60_000,
  });
  return { couriers: query.data ?? [], loading: query.isPending, error: query.isError, retry: query.refetch };
}
