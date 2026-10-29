"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getMetaAdDetail,
  getMetaCatalog,
  type MetaCatalogFilters,
} from "@/services/advertisingMetaService";
import { AdvertisingApiError, advertisingErrorStatus } from "@/services/advertisingService";

interface Identity {
  token: string | null | undefined;
  actorId: string | null | undefined;
  companyId: string | null | undefined;
  enabled?: boolean;
}

function useTokenRevalidation(token: Identity["token"], enabled: boolean, refetch: () => unknown) {
  const observedToken = useRef(token);
  useEffect(() => {
    if (observedToken.current === token) return;
    observedToken.current = token;
    if (enabled) void refetch();
  }, [token, enabled, refetch]);
}

export function useAdvertisingMetaCatalog({
  token,
  actorId,
  companyId,
  enabled: allowed = true,
  ...filters
}: Identity & MetaCatalogFilters) {
  const enabled = Boolean(allowed && token && actorId && companyId && filters.from && filters.to);
  const query = useQuery({
    queryKey: ["advertising-meta", actorId ?? null, companyId ?? null, "catalog", filters],
    queryFn: ({ signal }) => {
      if (!token || !companyId || !actorId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getMetaCatalog(token, companyId, filters, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (state) => {
      if (!enabled || state.state.error) return false;
      return state.state.data?.accounts.some(
        (account) =>
          account.historyImport &&
          ["pending", "running", "retrying"].includes(account.historyImport.status),
      )
        ? 5_000
        : false;
    },
    refetchIntervalInBackground: false,
  });
  useTokenRevalidation(token, enabled, query.refetch);
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}

export function useAdvertisingMetaAd({
  token,
  actorId,
  companyId,
  enabled: allowed = true,
  adId,
  from,
  to,
  accountId,
}: Identity & { adId: string | null; from: string; to: string; accountId: string | null }) {
  const enabled = Boolean(
    allowed && token && actorId && companyId && adId && accountId && from && to,
  );
  const query = useQuery({
    queryKey: [
      "advertising-meta",
      actorId ?? null,
      companyId ?? null,
      "ad",
      adId,
      accountId,
      from,
      to,
    ],
    queryFn: ({ signal }) => {
      if (!token || !companyId || !actorId || !adId || !accountId)
        throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
      return getMetaAdDetail(token, companyId, adId, { from, to, accountId }, signal);
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  useTokenRevalidation(token, enabled, query.refetch);
  const status = advertisingErrorStatus(query.error);
  const isAccessDenied = status === 401 || status === 403;
  return { ...query, data: enabled && !isAccessDenied ? query.data : undefined, isAccessDenied };
}
