"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AdvertisingApiError, advertisingErrorStatus } from "@/services/advertisingService";
import { getAdvertisingWorkspace } from "@/services/advertisingWorkspaceService";
import type { AdvertisingSnapshotOptions } from "./useAdvertisingSnapshot";

export function useAdvertisingWorkspace({
  token,
  actorId,
  companyId,
  from,
  to,
  enabled: allowed = true,
}: AdvertisingSnapshotOptions & { enabled?: boolean }) {
  const enabled = Boolean(allowed && token && actorId && companyId && from && to);
  const query = useQuery({
    queryKey: ["advertising-workspace", actorId ?? null, companyId ?? null, from, to],
    queryFn: ({ signal }) => {
      if (!token || !companyId || !actorId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getAdvertisingWorkspace(token, companyId, from, to, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const observedToken = useRef(token);
  useEffect(() => {
    if (observedToken.current === token) return;
    observedToken.current = token;
    if (enabled) void query.refetch();
  }, [token, enabled, query.refetch]);
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
