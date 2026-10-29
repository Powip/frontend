"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AdvertisingApiError, advertisingErrorStatus } from "@/services/advertisingService";
import {
  type AdvertisingSummaryV11Filters,
  getAdvertisingAssignmentsV11,
  getAdvertisingSummaryV11,
} from "@/services/advertisingV11Service";
import type { AdvertisingSnapshotOptions } from "./useAdvertisingSnapshot";

export function advertisingV11Key(
  actorId: string | null | undefined,
  companyId: string | null | undefined,
) {
  return ["advertising-workspace-v11", actorId ?? null, companyId ?? null] as const;
}
function useCurrentToken(
  token: AdvertisingSnapshotOptions["token"],
  enabled: boolean,
  refetch: () => unknown,
) {
  const current = useRef(token);
  useEffect(() => {
    if (current.current === token) return;
    current.current = token;
    if (enabled) void refetch();
  }, [token, enabled, refetch]);
}
export function useAdvertisingAssignmentsV11(
  identity: AdvertisingSnapshotOptions & { enabled?: boolean },
) {
  const { token, actorId, companyId, from, to } = identity;
  const enabled = Boolean(
    identity.enabled !== false && token && actorId && companyId && from && to,
  );
  const query = useQuery({
    queryKey: [...advertisingV11Key(actorId, companyId), "assignments", from, to],
    queryFn: ({ signal }) => {
      if (!token || !actorId || !companyId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getAdvertisingAssignmentsV11(token, companyId, from, to, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useCurrentToken(token, enabled, query.refetch);
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
export function useAdvertisingSummaryV11(
  identity: Omit<AdvertisingSnapshotOptions, "from" | "to"> & { enabled?: boolean },
  filters: AdvertisingSummaryV11Filters,
) {
  const { token, actorId, companyId } = identity;
  const enabled = Boolean(
    identity.enabled !== false && token && actorId && companyId && filters.from && filters.to,
  );
  const query = useQuery({
    queryKey: [...advertisingV11Key(actorId, companyId), "summary", filters],
    queryFn: ({ signal }) => {
      if (!token || !actorId || !companyId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getAdvertisingSummaryV11(token, companyId, filters, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useCurrentToken(token, enabled, query.refetch);
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
