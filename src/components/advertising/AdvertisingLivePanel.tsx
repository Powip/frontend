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
} from "@/services/advertisingService";
import {
  advertisingErrorMessage,
  importAdvertisingHistory,
  pauseAdvertisingUpdates,
  selectAdvertisingAccounts,
  startAdvertisingAuthorization,
} from "@/services/advertisingService";
import { AdvertisingConnections, AdvertisingDashboard } from "./AdvertisingDashboard";
import { AdvertisingEffectiveSpend } from "./AdvertisingEffectiveSpend";
import { AdvertisingLiveAccountsDialog } from "./AdvertisingLiveAccountsDialog";
import { AdvertisingManualReview } from "./AdvertisingManualReview";
import { AdvertisingModuleSummary } from "./AdvertisingModuleSummary";
import { advertisingHistoryNotice } from "./advertising-history";
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
  presentation?: "legacy" | "module";
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
  presentation = "legacy",
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
  const historyNoticeSnapshot = useRef(wire);
  const parsed = useMemo(() => {
    if (!wire) return { snapshot: null, invalid: false };
    try {
      return { snapshot: snapshotFromWire(wire), invalid: false };
    } catch {
      return { snapshot: null, invalid: true };
    }
  }, [wire]);
  const snapshot = parsed.snapshot;
  useEffect(() => {
    if (!wire || wire === historyNoticeSnapshot.current || notice !== "Importando historial…")
      return;
    const imports = wire.accounts.flatMap((account) =>
      account.historyImport ? [account.historyImport] : [],
    );
    if (imports.length > 0) setNotice(advertisingHistoryNotice(imports));
  }, [wire, notice]);
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
      if (mounted.current) {
        setDialogProvider(null);
        historyNoticeSnapshot.current = wire;
        setNotice(
          result.selectedCount > 0
            ? advertisingHistoryNotice(result.imports)
            : "Cuentas guardadas.",
        );
      }
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
        providers.map((provider) => importAdvertisingHistory(token, companyId, provider)),
      );
      if (mounted.current) {
        historyNoticeSnapshot.current = wire;
        setNotice(
          providers.length
            ? advertisingHistoryNotice(results.flatMap((result) => result.imports))
            : "No hay cuentas activas para actualizar.",
        );
      }
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
  const effectiveContent = wire.effective ? (
    <AdvertisingEffectiveSpend effective={wire.effective} from={from} to={to} />
  ) : undefined;
  const manualReviewContent = (
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
            Esta asignación manual se conserva. Se revisa antes de usarla como consumo de anuncios.
          </p>
          {manualContent}
        </details>
      )}
    </div>
  );
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
        <AdvertisingConnections
          snapshot={snapshot}
          showAccounts={presentation === "module"}
          from={from}
          to={to}
          {...actions}
        />
      ) : presentation === "module" ? (
        <AdvertisingModuleSummary
          companyName={companyName}
          from={from}
          to={to}
          snapshot={snapshot}
          effectiveContent={effectiveContent}
          manualReviewContent={manualReviewContent}
        />
      ) : (
        <AdvertisingDashboard
          companyName={companyName}
          from={from}
          to={to}
          snapshot={snapshot}
          manualContent={manualContent}
          effectiveContent={effectiveContent}
          manualReviewContent={manualReviewContent}
          {...actions}
        />
      )}
      <AdvertisingLiveAccountsDialog
        provider={dialogProvider}
        companyId={companyId}
        companyName={companyName}
        token={token}
        initialSelectedIds={initialSelectedIds}
        busy={pending === "save"}
        error={error}
        onClose={() => setDialogProvider(null)}
        onSave={save}
      />
    </div>
  );
}
