"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  type AdvertisingOrderFilters,
  getAdvertisingBusinessAnalytics,
  getAdvertisingOrderDetail,
  getAdvertisingOrders,
} from "@/services/advertisingOrdersService";
import { AdvertisingApiError, advertisingErrorStatus } from "@/services/advertisingService";

export interface AdvertisingOrdersIdentity {
  companyId?: string | null;
  actorId?: string | null;
  token?: string | null;
  enabled?: boolean;
}
function useRevalidate(token: string | null | undefined, enabled: boolean, refetch: () => unknown) {
  const observed = useRef(token);
  useEffect(() => {
    if (token === observed.current) return;
    observed.current = token;
    if (enabled) void refetch();
  }, [token, enabled, refetch]);
}
export function useAdvertisingOrders(
  identity: AdvertisingOrdersIdentity,
  filters: AdvertisingOrderFilters,
) {
  const enabled = Boolean(
    identity.enabled !== false && identity.companyId && identity.actorId && identity.token,
  );
  const query = useQuery({
    queryKey: [
      "advertising-orders",
      identity.actorId ?? null,
      identity.companyId ?? null,
      "orders",
      filters,
    ],
    queryFn: ({ signal }) => {
      if (!identity.companyId || !identity.token)
        throw new AdvertisingApiError("Vuelve a iniciar sesión.", 401);
      return getAdvertisingOrders(identity.token, identity.companyId, filters, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useRevalidate(identity.token, enabled, query.refetch);
  const isAccessDenied = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
export function useAdvertisingOrderDetail(
  identity: AdvertisingOrdersIdentity,
  orderId: string | null,
) {
  const enabled = Boolean(
    identity.enabled !== false &&
      identity.companyId &&
      identity.actorId &&
      identity.token &&
      orderId,
  );
  const query = useQuery({
    queryKey: [
      "advertising-orders",
      identity.actorId ?? null,
      identity.companyId ?? null,
      "detail",
      orderId,
    ],
    queryFn: ({ signal }) => {
      if (!identity.companyId || !identity.token || !orderId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión.", 401);
      return getAdvertisingOrderDetail(identity.token, identity.companyId, orderId, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useRevalidate(identity.token, enabled, query.refetch);
  const isAccessDenied = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
export function useAdvertisingBusinessAnalytics(
  identity: AdvertisingOrdersIdentity,
  filters: AdvertisingOrderFilters,
) {
  const enabled = Boolean(
    identity.enabled !== false && identity.companyId && identity.actorId && identity.token,
  );
  const query = useQuery({
    queryKey: [
      "advertising-orders",
      identity.actorId ?? null,
      identity.companyId ?? null,
      "analytics",
      filters,
    ],
    queryFn: ({ signal }) => {
      if (!identity.companyId || !identity.token)
        throw new AdvertisingApiError("Vuelve a iniciar sesión.", 401);
      return getAdvertisingBusinessAnalytics(identity.token, identity.companyId, filters, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useRevalidate(identity.token, enabled, query.refetch);
  const isAccessDenied = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
