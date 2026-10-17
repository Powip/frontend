"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { adsGet, type AdsIdentity, type AdsSettings } from "@/services/advertisingV22Service";
import { advertisingErrorStatus } from "@/services/advertisingService";

interface ContextValue {
  identity: AdsIdentity | null;
  actorId: string | null;
  settings: AdsSettings | undefined;
  loading: boolean;
  error: unknown;
  reload: () => Promise<unknown>;
}
const Context = createContext<ContextValue | null>(null);
export function AdvertisingV22Provider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const identity =
    auth?.accessToken && auth.company?.id
      ? { token: auth.accessToken, companyId: auth.company.id }
      : null;
  const query = useQuery({
    queryKey: ["ads-v22", auth?.user.id, auth?.company?.id, "settings"],
    queryFn: ({ signal }) => adsGet<AdsSettings>(identity!, "/v22/settings", undefined, signal),
    enabled: !!identity,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const verifiedToken = useRef(identity?.token);
  const { refetch } = query;
  const [, setVerified] = useState(0);
  const tokenMatches = verifiedToken.current === identity?.token;
  useEffect(() => {
    if (verifiedToken.current === identity?.token || !identity?.token) return;
    let cancelled = false;
    void refetch().finally(() => {
      if (!cancelled) {
        verifiedToken.current = identity.token;
        setVerified((value) => value + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [identity?.token, refetch]);
  return (
    <Context.Provider
      value={{
        identity,
        actorId: auth?.user.id ?? null,
        settings: query.isError || !tokenMatches ? undefined : query.data,
        loading: query.isPending || !tokenMatches,
        error: query.error,
        reload: query.refetch,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAdsV22() {
  const context = useContext(Context);
  if (!context) throw new Error("Publicidad requiere su contexto de acceso.");
  return context;
}
export function useAdsQuery<T>(
  key: unknown[],
  request: (identity: AdsIdentity, signal: AbortSignal) => Promise<T>,
  enabled = true,
): UseQueryResult<T> {
  const { identity, actorId, settings } = useAdsV22();
  const query = useQuery({
    queryKey: ["ads-v22", actorId, identity?.companyId, ...key],
    queryFn: ({ signal }) => request(identity!, signal),
    enabled: !!identity && settings?.capabilities.view === true && enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const forbidden = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return {
    ...query,
    data: forbidden || !identity || !settings?.capabilities.view ? undefined : query.data,
  } as UseQueryResult<T>;
}
export function useRefreshAds() {
  const client = useQueryClient();
  const { actorId, identity, reload } = useAdsV22();
  return async () => {
    await client.invalidateQueries({ queryKey: ["ads-v22", actorId, identity?.companyId] });
    await reload();
  };
}
