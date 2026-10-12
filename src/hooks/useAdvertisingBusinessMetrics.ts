"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  type AdvertisingBusinessMetricsFilters,
  getAdvertisingBusinessMetrics,
} from "@/services/advertisingBusinessMetricsService";
import { AdvertisingApiError, advertisingErrorStatus } from "@/services/advertisingService";
import type { AdvertisingOrdersIdentity } from "./useAdvertisingOrders";

export function useAdvertisingBusinessMetrics(
  identity: AdvertisingOrdersIdentity,
  filters: AdvertisingBusinessMetricsFilters,
) {
  const { actorId, companyId, token } = identity;
  const enabled = Boolean(
    identity.enabled !== false && actorId && companyId && token && filters.storeId !== "none",
  );
  const query = useQuery({
    queryKey: ["advertising-business-metrics", actorId ?? null, companyId ?? null, filters],
    queryFn: ({ signal }) => {
      if (!token || !companyId || !actorId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getAdvertisingBusinessMetrics(token, companyId, filters, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const refetch = query.refetch;
  const observedToken = useRef(token);
  useEffect(() => {
    if (observedToken.current === token) return;
    observedToken.current = token;
    if (enabled) void refetch();
  }, [token, enabled, refetch]);
  const isAccessDenied = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
