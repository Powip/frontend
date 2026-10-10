"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  AdvertisingApiError,
  advertisingErrorStatus,
  getAdvertisingSnapshot,
} from "@/services/advertisingService";

export interface AdvertisingSnapshotOptions {
  token: string | null | undefined;
  actorId: string | null | undefined;
  companyId: string | null | undefined;
  from: string;
  to: string;
}

export function advertisingSnapshotKey(
  actorId: string | null | undefined,
  companyId: string | null | undefined,
  from: string,
  to: string,
) {
  return ["advertising-snapshot", actorId ?? null, companyId ?? null, from, to] as const;
}

export function useAdvertisingSnapshot({
  token,
  actorId,
  companyId,
  from,
  to,
}: AdvertisingSnapshotOptions) {
  const enabled = Boolean(token && actorId && companyId && from && to);
  const query = useQuery({
    queryKey: advertisingSnapshotKey(actorId, companyId, from, to),
    queryFn: ({ signal }) => {
      if (!token || !companyId || !actorId) {
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      }
      return getAdvertisingSnapshot(token, companyId, from, to, signal);
    },
    enabled,
    // Every mount revalidates access. Unused results disappear on actor/tenant changes.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  const observedToken = useRef(token);
  useEffect(() => {
    if (observedToken.current === token) return;
    observedToken.current = token;
    if (enabled) void query.refetch();
  }, [token, enabled, query.refetch]);

  return {
    ...query,
    // React Query can retain prior data after a failed refetch. Never display it after access denial.
    data: enabled && !isAccessDenied ? query.data : undefined,
    isAccessDenied,
  };
}
