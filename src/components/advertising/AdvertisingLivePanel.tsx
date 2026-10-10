"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import type {
  AdvertisingProviderWire,
  AdvertisingSelectionPayload,
  AdvertisingSyncRun,
} from "@/services/advertisingService";
import {
  advertisingErrorMessage,
  pauseAdvertisingUpdates,
  selectAdvertisingAccounts,
  startAdvertisingAuthorization,
  syncAdvertisingSpend,
} from "@/services/advertisingService";
import { AdvertisingConnections, AdvertisingDashboard } from "./AdvertisingDashboard";
import { AdvertisingEffectiveSpend } from "./AdvertisingEffectiveSpend";
import { AdvertisingLiveAccountsDialog } from "./AdvertisingLiveAccountsDialog";
import { AdvertisingManualReview } from "./AdvertisingManualReview";
import { snapshotFromWire } from "./advertising-model";

interface Props {
  companyId: string | null | undefined;
  actorId: string | null | undefined;
  token: string | null | undefined;
  companyName: string;
  from: string;
  to: string;
  manualContent?: ReactNode;
  connectionsOnly?: boolean;
  storeIds?: string[];
}

const EMPTY_STORE_IDS: string[] = [];

export function validatedAdvertisingAuthorizationUrl(
  provider: AdvertisingProviderWire,
  value: string,
): string {
  const url = new URL(value);
  if (
    provider !== "meta" ||
    url.origin !== "https://www.facebook.com" ||
    !/^\/v\d+\.\d+\/dialog\/oauth$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error("No pudimos iniciar la conexión. Inténtalo de nuevo.");
  }
  return url.toString();
}

function syncNotice(runs: AdvertisingSyncRun[]): string {
  if (runs.some((run) => run.status === "failed"))
    return "Algunas cuentas no se actualizaron. Revisa el estado de los datos.";
  if (runs.some((run) => run.status === "busy")) return "La actualización ya está en curso.";
  if (runs.some((run) => run.status === "paused"))
    return "Hay cuentas con actualizaciones pausadas.";
  return runs.length ? "Datos actualizados." : "No hay cuentas activas para actualizar.";
}

export function AdvertisingLivePanel({
  companyId,
  actorId,
  token,
  companyName,
  from,
  to,
  manualContent,
  connectionsOnly = false,
  storeIds = EMPTY_STORE_IDS,
}: Props) {
  const queryClient = useQueryClient();
  const query = useAdvertisingSnapshot({ token, actorId, companyId, from, to });
  const [dialogProvider, setDialogProvider] = useState<AdvertisingProviderWire | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const openedConnected = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const wire = query.data;
  const parsed = useMemo(() => {
    if (!wire) return { snapshot: null, invalid: false };
    try {
      return { snapshot: snapshotFromWire(wire), invalid: false };
    } catch {
      return { snapshot: null, invalid: true };
    }
  }, [wire]);
  const snapshot = parsed.snapshot;
  const initialSelectedIds = useMemo(
    () =>
      wire?.accounts
        .filter((account) => account.provider === dialogProvider && account.enabled)
        .map((account) => account.externalId) ?? [],
    [wire?.accounts, dialogProvider],
  );

  useEffect(() => {
    if (!wire || openedConnected.current) return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    if (connected !== "meta" && connected !== "tiktok") return;
    openedConnected.current = true;
    url.searchParams.delete("connected");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (wire.capabilities.canManage && wire.providers[connected].status === "connected")
      setDialogProvider(connected);
  }, [wire]);

  async function connect(provider: AdvertisingProviderWire) {
    if (!token || !companyId || pending) return;
    setPending("connect");
    setError(null);
    setNotice(null);
    try {
      const { url } = await startAdvertisingAuthorization(token, companyId, provider);
      if (mounted.current)
        window.location.assign(validatedAdvertisingAuthorizationUrl(provider, url));
    } catch (failure: unknown) {
      if (mounted.current) setError(advertisingErrorMessage(failure));
    } finally {
      if (mounted.current) setPending(null);
    }
  }

  async function pause(provider: AdvertisingProviderWire) {
    if (!token || !companyId || pending) return;
    setPending("pause");
    setError(null);
    setNotice(null);
    try {
      await pauseAdvertisingUpdates(token, companyId, provider);
      if (mounted.current) {
        setNotice("Actualizaciones pausadas.");
        await query.refetch();
      }
    } catch (failure: unknown) {
      if (mounted.current) setError(advertisingErrorMessage(failure));
    } finally {
      if (mounted.current) setPending(null);
    }
  }

  async function save(payload: AdvertisingSelectionPayload) {
    if (!token || !companyId || !dialogProvider || !wire || pending) return;
    const provider = dialogProvider;
    setPending("save");
    setError(null);
    setNotice(null);
    let selected = false;
    try {
      const result = await selectAdvertisingAccounts(token, companyId, provider, payload);
      selected = true;
      if (mounted.current) setDialogProvider(null);
      const syncTo = to <= wire.today ? to : wire.today;
      if (result.selectedCount > 0 && from <= syncTo) {
        const { runs } = await syncAdvertisingSpend(token, companyId, provider, {
          from,
          to: syncTo,
        });
        if (mounted.current) setNotice(syncNotice(runs));
      } else if (mounted.current) setNotice("Cuentas guardadas.");
    } catch (failure: unknown) {
      if (mounted.current) setError(advertisingErrorMessage(failure));
    } finally {
      if (mounted.current) {
        if (selected) await query.refetch();
        setPending(null);
      }
    }
  }

  async function refresh() {
    if (!token || !companyId || !wire || pending) return;
    const syncTo = to <= wire.today ? to : wire.today;
    if (from > syncTo) {
      setError("Elige un periodo hasta hoy para actualizar.");
      return;
    }
    setPending("sync");
    setError(null);
    setNotice(null);
    try {
      const providers = (["meta", "tiktok"] as const).filter(
        (provider) =>
          wire.providers[provider].available &&
          wire.providers[provider].status === "connected" &&
          wire.accounts.some((account) => account.provider === provider && account.enabled),
      );
      const results = await Promise.all(
        providers.map((provider) =>
          syncAdvertisingSpend(token, companyId, provider, { from, to: syncTo }),
        ),
      );
      if (mounted.current) setNotice(syncNotice(results.flatMap((result) => result.runs)));
    } catch (failure: unknown) {
      if (mounted.current) setError(advertisingErrorMessage(failure));
    } finally {
      if (mounted.current) {
        await query.refetch();
        setPending(null);
      }
    }
  }

  if (!token || !actorId || !companyId)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Inicia sesión con una empresa para consultar publicidad.
      </p>
    );
  if (query.isError || parsed.invalid)
    return (
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="space-y-3">
            <p role="alert" className="text-sm">
              {parsed.invalid
                ? "No pudimos leer los datos de publicidad. Inténtalo de nuevo."
                : advertisingErrorMessage(query.error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Volver a intentar
            </Button>
          </CardContent>
        </Card>
        {!query.isAccessDenied && manualContent && (
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              Ver registros manuales
            </summary>
            {manualContent}
          </details>
        )}
      </div>
    );
  if (!wire || !snapshot)
    return (
      <div className="space-y-4 p-4 sm:p-6 lg:p-8" role="status" aria-label="Cargando publicidad">
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    );
  const manage = wire.capabilities.canManage;
  const actions =
    manage && !pending
      ? {
          onConnect: (provider: AdvertisingProviderWire) => void connect(provider),
          onReconnect: (provider: AdvertisingProviderWire) => void connect(provider),
          onManage: (provider: AdvertisingProviderWire) => {
            setError(null);
            setNotice(null);
            setDialogProvider(provider);
          },
          onPause: (provider: AdvertisingProviderWire) => void pause(provider),
        }
      : {};
  return (
    <div className="min-w-0 space-y-4">
      <div className={connectionsOnly ? "space-y-3" : "space-y-3 px-4 pt-4 sm:px-6 lg:px-8"}>
        {error && dialogProvider === null && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {pending === "connect"
              ? "Abriendo la conexión…"
              : pending === "pause"
                ? "Pausando actualizaciones…"
                : "Actualizando datos…"}
          </p>
        )}
        {manage && wire.accounts.some((account) => account.enabled) && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null || query.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" />
            Actualizar gasto
          </Button>
        )}
        {!manage && Object.values(wire.providers).some((provider) => provider.available) && (
          <p className="text-xs text-muted-foreground">
            Necesitas permiso para gestionar estas cuentas.
          </p>
        )}
      </div>
      {connectionsOnly ? (
        <AdvertisingConnections snapshot={snapshot} {...actions} />
      ) : (
        <AdvertisingDashboard
          companyName={companyName}
          from={from}
          to={to}
          snapshot={snapshot}
          manualContent={manualContent}
          effectiveContent={
            wire.effective ? (
              <AdvertisingEffectiveSpend effective={wire.effective} from={from} to={to} />
            ) : undefined
          }
          manualReviewContent={
            <div className="space-y-4">
              <AdvertisingManualReview
                snapshot={snapshot}
                isDemo={false}
                live={{
                  wire,
                  companyId,
                  token,
                  storeIds,
                  canReconcile: wire.capabilities.canReconcile,
                  onChanged: async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["advertising-snapshot", actorId, companyId],
                    });
                  },
                }}
              />
              {manualContent && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer p-4 text-sm font-medium">
                    Registros originales de este navegador
                  </summary>
                  <p className="px-4 pb-3 text-xs text-muted-foreground">
                    Esta asignación manual se conserva. Se revisa antes de usarla como consumo de
                    anuncios.
                  </p>
                  {manualContent}
                </details>
              )}
            </div>
          }
          {...actions}
        />
      )}
      <AdvertisingLiveAccountsDialog
        provider={dialogProvider}
        companyId={companyId}
        companyName={companyName}
        token={token}
        from={from}
        today={wire.today}
        initialSelectedIds={initialSelectedIds}
        busy={pending === "save"}
        error={error}
        onClose={() => setDialogProvider(null)}
        onSave={save}
      />
    </div>
  );
}
