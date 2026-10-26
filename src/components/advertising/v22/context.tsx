"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  dataScope: string;
  accessDenied: (error: unknown) => void;
}
export const ADS_DATA_STALE_TIME = 30_000;
export const ADS_DATA_GC_TIME = 5 * 60_000;
const permissionScope = (settings: AdsSettings | undefined) =>
  JSON.stringify([
    settings?.version ?? null,
    ...(["view", "spend", "profit", "edit", "configure"] as const).map(
      (capability) => settings?.capabilities[capability] === true,
    ),
  ]);
const Context = createContext<ContextValue | null>(null);
export function AdvertisingV22Provider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const client = useQueryClient();
  const providerId = useId();
  const actorId = auth?.user.id ?? null;
  const identity =
    auth?.accessToken && auth.company?.id
      ? { token: auth.accessToken, companyId: auth.company.id }
      : null;
  const settingsKey = ["ads-v22", actorId, identity?.companyId, "settings"];
  const initialAccess = useRef({
    actorId, companyId: identity?.companyId,
    dataUpdates: client.getQueryState(settingsKey)?.dataUpdateCount ?? 0,
    errorUpdates: client.getQueryState(settingsKey)?.errorUpdateCount ?? 0,
  });
  const [generation, setGeneration] = useState(0);
  const [denied, setDenied] = useState<unknown>(null);
  const purgeData = useCallback(async (actor: string | null, company: string | undefined) => {
    const filters = {
      predicate: (entry: { queryKey: readonly unknown[] }) =>
        entry.queryKey[0] === "ads-v22" &&
        entry.queryKey[1] === actor &&
        entry.queryKey[2] === company &&
        entry.queryKey[3] !== "settings",
    };
    await client.cancelQueries(filters);
    client.removeQueries(filters);
  }, [client]);
  const query = useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => adsGet<AdsSettings>(identity!, "/v22/settings", undefined, signal),
    enabled: !!identity,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const verifiedIdentity = useRef<{ token?: string; actorId: string | null; companyId?: string }>({
    actorId: null,
  });
  const requestedToken = useRef(identity?.token);
  const { refetch } = query;
  const tokenMatches =
    verifiedIdentity.current.token === identity?.token &&
    verifiedIdentity.current.actorId === actorId &&
    verifiedIdentity.current.companyId === identity?.companyId;
  useEffect(() => {
    if (tokenMatches) return;
    let cancelled = false;
    const previous = verifiedIdentity.current;
    const firstVerification = previous.actorId === null && previous.token === undefined;
    const tokenChanged = requestedToken.current !== identity?.token;
    void (async () => {
      await purgeData(previous.actorId, previous.companyId);
      if (actorId !== previous.actorId || identity?.companyId !== previous.companyId)
        await purgeData(actorId, identity?.companyId);
      if (cancelled) return;
      if (tokenChanged) {
        await client.cancelQueries({ queryKey: ["ads-v22", actorId, identity?.companyId, "settings"], exact: true });
        requestedToken.current = identity?.token;
      }
      // Reuse this mount's fresh access request, never a cached response from an older mount.
      const current = client.getQueryState(["ads-v22", actorId, identity?.companyId, "settings"]);
      const fetchedThisMount = initialAccess.current.actorId === actorId &&
        initialAccess.current.companyId === identity?.companyId &&
        ((current?.dataUpdateCount ?? 0) > initialAccess.current.dataUpdates ||
          (current?.errorUpdateCount ?? 0) > initialAccess.current.errorUpdates);
      if (identity?.token && (tokenChanged || !firstVerification || !fetchedThisMount))
        await refetch({ cancelRefetch: false });
      if (!cancelled) {
        verifiedIdentity.current = { token: identity?.token, actorId, companyId: identity?.companyId };
        setDenied(null);
        setGeneration((value) => value + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actorId, identity?.companyId, identity?.token, tokenMatches, refetch, purgeData, client]);
  const permissions = permissionScope(query.data);
  useEffect(() => {
    if (query.isError || query.data?.capabilities.view === false) {
      void purgeData(actorId, identity?.companyId);
      return;
    }
    if (!query.data || !tokenMatches) return;
    const currentScope = `${providerId}:${generation}:${permissions}`;
    const obsolete = {
      predicate: (entry: { queryKey: readonly unknown[] }) =>
        entry.queryKey[0] === "ads-v22" && entry.queryKey[1] === actorId &&
        entry.queryKey[2] === identity?.companyId && entry.queryKey[3] === "data" &&
        entry.queryKey[4] !== currentScope,
    };
    void client.cancelQueries(obsolete).then(() => client.removeQueries(obsolete));
  }, [actorId, identity?.companyId, permissions, providerId, generation, query.isError, query.data, tokenMatches, purgeData, client]);
  const accessDenied = useCallback((error: unknown) => {
    setDenied(error);
    void purgeData(actorId, identity?.companyId);
  }, [actorId, identity?.companyId, purgeData]);
  const reload = useCallback(async () => {
    if (denied) await purgeData(actorId, identity?.companyId);
    const result = await refetch();
    if (!result.isError) {
      if (denied) setGeneration((value) => value + 1);
      setDenied(null);
    }
    return result;
  }, [denied, actorId, identity?.companyId, purgeData, refetch]);
  return (
    <Context.Provider
      value={{
        identity,
        actorId,
        settings: query.isError || !tokenMatches || denied ? undefined : query.data,
        loading: query.isPending || !tokenMatches,
        error: denied ?? query.error,
        reload,
        dataScope: `${providerId}:${generation}:${permissions}`,
        accessDenied,
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
  const { identity, actorId, settings, dataScope, accessDenied } = useAdsV22();
  const query = useQuery({
    queryKey: ["ads-v22", actorId, identity?.companyId, "data", dataScope, ...key],
    queryFn: async ({ signal }) => {
      try {
        return await request(identity!, signal);
      } catch (error) {
        if (!signal.aborted && [401, 403].includes(advertisingErrorStatus(error) ?? 0)) accessDenied(error);
        throw error;
      }
    },
    enabled: !!identity && settings?.capabilities.view === true && enabled,
    retry: false,
    staleTime: ADS_DATA_STALE_TIME,
    gcTime: ADS_DATA_GC_TIME,
  });
  const forbidden = [401, 403].includes(advertisingErrorStatus(query.error) ?? 0);
  return {
    ...query,
    data: forbidden || !identity || !settings?.capabilities.view ? undefined : query.data,
  } as UseQueryResult<T>;
}
export function useRefreshAds() {
  const client = useQueryClient();
  const { actorId, identity } = useAdsV22();
  return async () => {
    await client.invalidateQueries({ queryKey: ["ads-v22", actorId, identity?.companyId] });
  };
}
