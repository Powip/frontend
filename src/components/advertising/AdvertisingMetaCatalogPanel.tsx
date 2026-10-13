"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import { useAdvertisingBusinessAnalytics } from "@/hooks/useAdvertisingOrders";
import { useAdvertisingTablePreferences } from "@/hooks/useAdvertisingTablePreferences";
import {
  type MetaCatalogLevel,
  type MetaCatalogRow,
  type MetaCatalogSort,
  type MetaResultType,
  syncMetaModule,
} from "@/services/advertisingMetaService";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import { AdvertisingMetaMetricsTable } from "./AdvertisingMetaMetricsTable";
import { useAdvertisingStoreFilter } from "./AdvertisingStoreFilterContext";
import { businessResult } from "./advertising-business-results";
import { metaCoverageLabel, metaResultCostLabel, validMetaPeriod } from "./advertising-meta-model";
import {
  advertisingMetaBusinessValues,
  advertisingMetaTableCsv,
  advertisingMetaTableValues,
} from "./advertising-meta-table-model";
import { advertisingSectionHref } from "./advertising-sections";

const AdDetail = dynamic(() =>
  import("./AdvertisingMetaAdDetail").then((module) => module.AdvertisingMetaAdDetail),
);
const TITLES: Record<MetaCatalogLevel, string> = {
  campaign: "Campañas",
  adset: "Conjuntos de anuncios",
  ad: "Anuncios",
};
interface Props {
  token: string | null | undefined;
  actorId: string | null | undefined;
  companyId: string | null | undefined;
  from: string;
  to: string;
  level: MetaCatalogLevel;
  initialAccountId?: string;
  initialAdId?: string;
  campaignId?: string;
  adsetId?: string;
  initialResultType?: MetaResultType;
  presentation?: "results";
}

export function AdvertisingMetaCatalogPanel({
  initialAccountId,
  initialAdId,
  initialResultType,
  presentation,
  ...props
}: Props) {
  const id = useId();
  const queryClient = useQueryClient();
  const { storeId } = useAdvertisingStoreFilter();
  const { more: moreMetrics, setMore: setMoreMetrics } = useAdvertisingTablePreferences(
    props.actorId,
  );
  const [accountId, setAccountId] = useState(initialAccountId ?? "all");
  const [focusedAdId, setFocusedAdId] = useState(initialAdId);
  const [focusedDetailClosed, setFocusedDetailClosed] = useState(false);
  const [currency, setCurrency] = useState("all");
  const [resultType, setResultType] = useState<MetaResultType>(initialResultType ?? "messages");
  const [sortBy, setSortBy] = useState<MetaCatalogSort>("results");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<MetaCatalogRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const validPeriod = validMetaPeriod(props.from, props.to);
  const query = useAdvertisingMetaCatalog({
    ...props,
    enabled: validPeriod,
    accountId: accountId === "all" ? undefined : accountId,
    currency: currency === "all" ? undefined : currency,
    adId: props.level === "ad" ? focusedAdId : undefined,
    resultType,
    sortBy,
    sortOrder: sortBy === "costPerResult" ? "asc" : "desc",
    page,
    pageSize: 50,
    storeId,
  });
  const catalog = query.data;
  const scopedTimeZones = [
    ...new Set(
      catalog?.accounts
        .filter((account) => accountId === "all" || account.id === accountId)
        .map((account) => account.timeZone) ?? [],
    ),
  ];
  const businessEnabled =
    validPeriod &&
    (props.level === "ad" || props.level === "campaign") &&
    !!catalog &&
    storeId !== "none";
  const business = useAdvertisingBusinessAnalytics(
    {
      ...props,
      enabled: businessEnabled,
    },
    {
      from: props.from,
      to: props.to,
      basis: "delivered",
      timeZone: scopedTimeZones.length === 1 ? scopedTimeZones[0] : "America/Lima",
      groupBy: props.level === "campaign" ? "campaign" : "ad",
      storeId,
      channelId: "all",
    },
  );
  const extraBusinessEnabled = businessEnabled && moreMetrics;
  const salesBusiness = useAdvertisingBusinessAnalytics(
    { ...props, enabled: extraBusinessEnabled },
    {
      from: props.from,
      to: props.to,
      basis: "created",
      timeZone: scopedTimeZones.length === 1 ? scopedTimeZones[0] : "America/Lima",
      groupBy: props.level === "campaign" ? "campaign" : "ad",
      storeId,
      channelId: "all",
    },
  );
  const paidBusiness = useAdvertisingBusinessAnalytics(
    { ...props, enabled: extraBusinessEnabled },
    {
      from: props.from,
      to: props.to,
      basis: "paid",
      timeZone: scopedTimeZones.length === 1 ? scopedTimeZones[0] : "America/Lima",
      groupBy: props.level === "campaign" ? "campaign" : "ad",
      storeId,
      channelId: "all",
    },
  );
  const businessFailures = [
    { enabled: businessEnabled, query: business },
    { enabled: extraBusinessEnabled, query: salesBusiness },
    { enabled: extraBusinessEnabled, query: paidBusiness },
  ].filter((source) => source.enabled && source.query.isError);
  const observedStore = useRef(storeId);
  useEffect(() => {
    if (observedStore.current === storeId) return;
    observedStore.current = storeId;
    setPage(1);
    setSelected(null);
    setFocusedAdId(undefined);
  }, [storeId]);
  function valuesFor(row: MetaCatalogRow) {
    const analytics = business.data;
    const match = analytics?.rows.find(
      (item) =>
        item.id === row.id && item.accountId === row.accountId && item.currency === row.currency,
    );
    const compatibleScope =
      (analytics?.storeId ?? "all") === storeId && (analytics?.channelId ?? "all") === "all";
    let cpe: string | null = null;
    let cpeReason: string | null =
      storeId === "none"
        ? "Asigna una tienda para comparar."
        : props.level === "adset"
          ? "No hay vinculación de pedidos por conjunto."
          : business.isError
            ? advertisingErrorMessage(business.error)
            : business.isPending
              ? "Consultando entregas de Powip."
              : "Sin pedidos vinculados.";
    if (match && analytics && compatibleScope && storeId !== "none") {
      try {
        const result = businessResult(match, analytics, catalog ?? null);
        cpe = result.cpe;
        cpeReason = result.reason ?? (cpe === null ? "Sin entregados en el periodo." : null);
      } catch {
        cpe = null;
        cpeReason = "Datos de pedidos por revisar.";
      }
    } else if (analytics && !compatibleScope) {
      cpeReason = "La tienda o el canal no coincide.";
    }
    const extraValues = advertisingMetaBusinessValues(
      row,
      catalog ?? null,
      {
        sales: salesBusiness.data,
        delivered: business.data,
        paid: paidBusiness.data,
      },
      storeId,
    );
    return advertisingMetaTableValues(
      row,
      resultType,
      cpe,
      match?.deliveredCount,
      extraValues,
      cpeReason,
    );
  }
  function exportCsv() {
    if (!catalog || query.isAccessDenied) return;
    const csv = advertisingMetaTableCsv(
      catalog.rows.map((row) => ({ row, values: valuesFor(row) })),
      moreMetrics,
      props.level,
    );
    const downloadUrl = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `publicidad-${props.level}-${props.from}-${props.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }
  const detailRow =
    selected ??
    (!focusedDetailClosed && focusedAdId && props.level === "ad"
      ? catalog?.rows.find((row) => row.id === focusedAdId && row.accountId === accountId)
      : null);
  const incompleteImports =
    catalog?.accounts.filter(
      (account) =>
        (accountId === "all" || account.id === accountId) &&
        account.historyImport &&
        account.historyImport.status !== "succeeded",
    ) ?? [];
  const activeImports =
    catalog?.accounts.filter(
      (account) =>
        (accountId === "all" || account.id === accountId) &&
        account.historyImport &&
        ["pending", "running", "retrying"].includes(account.historyImport.status),
    ) ?? [];
  const currencies = [...new Set(catalog?.accounts.map((account) => account.currency) ?? [])];
  const canRankMoney = currency !== "all" || accountId !== "all" || currencies.length === 1;
  const syncAllowed =
    catalog?.capabilities.canSync &&
    catalog.accounts.some(
      (account) => account.enabled && (accountId === "all" || account.id === accountId),
    );

  async function sync() {
    if (!props.token || !props.companyId || !syncAllowed || syncing || !validPeriod) return;
    setSyncing(true);
    setSyncError(null);
    setNotice(null);
    try {
      const result = await syncMetaModule(props.token, props.companyId, {
        from: props.from,
        to: props.to,
        accountId: accountId === "all" ? undefined : accountId,
      });
      if (!mounted.current) return;
      const jobs = result.jobs ?? [];
      const importing = jobs.some((job) => ["pending", "running", "retrying"].includes(job.status));
      const failed =
        jobs.filter((job) => job.status === "failed").length +
        result.runs.filter((run) => run.status === "failed").length;
      const busy = result.runs.some((run) => run.status === "busy");
      const succeeded =
        jobs.filter((job) => job.status === "succeeded").length +
        result.runs.filter((run) => run.status === "succeeded").length;
      setNotice(
        failed
          ? `No se completó la actualización de ${failed} ${failed === 1 ? "cuenta" : "cuentas"}. Los datos guardados se conservan.`
          : importing
            ? "Importación del historial en curso. Puedes seguir consultando los datos guardados."
            : busy
              ? "Hay una actualización en curso. Vuelve a consultar en unos momentos."
              : succeeded
                ? "Resultados de Meta actualizados."
                : "No hay cuentas activas para actualizar.",
      );
      await queryClient.invalidateQueries({
        queryKey: ["advertising-meta", props.actorId, props.companyId],
      });
    } catch (error: unknown) {
      if (mounted.current) setSyncError(advertisingErrorMessage(error));
      if ([401, 403].includes(advertisingErrorStatus(error) ?? 0) && mounted.current)
        await query.refetch();
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }

  if (!validPeriod)
    return (
      <Alert className="m-4 max-w-xl" role="status">
        <AlertDescription>
          Elige un periodo de hasta 366 días para consultar resultados de Meta. El gasto de cuenta
          conserva todo el historial importado en Resumen.
        </AlertDescription>
      </Alert>
    );
  if (!props.token || !props.actorId || !props.companyId)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Inicia sesión con una empresa para consultar Meta.
      </p>
    );

  return (
    <section
      className="min-w-0 space-y-3 p-4 sm:p-6 lg:p-8"
      aria-label={
        presentation === "results" ? "Resultados de Meta" : `${TITLES[props.level]} de Meta`
      }
    >
      {presentation !== "results" ? <h2 className="font-semibold">{TITLES[props.level]}</h2> : null}
      {props.campaignId ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={advertisingSectionHref("/publicidad/campanas", props.from, props.to, { storeId })}
          >
            Todas las campañas
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span>Campaña seleccionada</span>
          {props.adsetId ? (
            <>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span>Conjunto seleccionado</span>
            </>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {syncError ? (
        <Alert variant="destructive">
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      ) : null}
      {incompleteImports.length ? (
        <section
          className="space-y-2 rounded-lg border border-border p-4"
          aria-label="Importación del historial de Meta"
          aria-live="polite"
        >
          <h3 className="text-sm font-semibold">Importación del historial</h3>
          {incompleteImports.map((account) => (
            <p key={account.id} className="text-xs text-muted-foreground">
              {account.name} · {account.historyImport?.completedWindows ?? 0}
              {account.historyImport?.totalWindows
                ? ` de ${account.historyImport.totalWindows}`
                : ""}{" "}
              ventanas importadas ·{" "}
              {account.historyImport?.status === "failed"
                ? "No se completó. Los datos guardados se conservan."
                : account.historyImport?.status === "paused"
                  ? "En pausa. Revisa la cuenta en Conexiones."
                  : account.historyImport?.status === "retrying"
                    ? account.historyImport.errorCode === "PROVIDER_RATE"
                      ? "Esperando a Meta. Se reintentará automáticamente."
                      : "Reintentando"
                    : account.historyImport?.status === "pending"
                      ? "Pendiente"
                      : "En curso"}
            </p>
          ))}
        </section>
      ) : null}
      {query.isError ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p role="alert" className="text-sm">
              {[404, 503].includes(advertisingErrorStatus(query.error) ?? 0)
                ? "El catálogo de Meta aún no está disponible."
                : advertisingErrorMessage(query.error)}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Volver a intentar
            </Button>
          </CardContent>
        </Card>
      ) : !catalog ? (
        <Skeleton className="h-64" aria-label="Cargando resultados de Meta" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <fieldset
              aria-label="Conversión a consultar"
              className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-auto"
            >
              {(["messages", "webPurchases"] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={resultType === type ? "default" : "ghost"}
                  aria-pressed={resultType === type}
                  onClick={() => {
                    setResultType(type);
                    setPage(1);
                  }}
                >
                  {type === "messages" ? "Mensajes" : "Compras por web"}
                </Button>
              ))}
            </fieldset>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={filtersOpen}
              aria-controls={`${id}-filters`}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filtros
              {currency !== "all" ? ` · ${currency}` : accountId !== "all" ? " · 1 cuenta" : ""}
            </Button>
          </div>
          {filtersOpen ? (
            <div
              id={`${id}-filters`}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-account`}>Cuenta Meta</Label>
                  <Select
                    value={accountId}
                    onValueChange={(value) => {
                      setAccountId(value);
                      setFocusedAdId(undefined);
                      setSelected(null);
                      setPage(1);
                      if (sortBy === "spend" || sortBy === "costPerResult") setSortBy("results");
                    }}
                  >
                    <SelectTrigger id={`${id}-account`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las cuentas</SelectItem>
                      {catalog.accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} · {account.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-currency`}>Moneda</Label>
                  <Select
                    value={currency}
                    onValueChange={(value) => {
                      setCurrency(value);
                      setPage(1);
                      if (value === "all" && (sortBy === "spend" || sortBy === "costPerResult"))
                        setSortBy("results");
                    }}
                  >
                    <SelectTrigger id={`${id}-currency`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las monedas</SelectItem>
                      {currencies.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-sort`}>Ordenar por</Label>
                  <Select
                    value={sortBy}
                    onValueChange={(value) => {
                      if (
                        value === "clicks" ||
                        value === "impressions" ||
                        value === "results" ||
                        ((value === "spend" || value === "costPerResult") && canRankMoney)
                      ) {
                        // Keep money sorting explicitly scoped if another currency is linked later.
                        if (
                          (value === "spend" || value === "costPerResult") &&
                          accountId === "all" &&
                          currency === "all"
                        )
                          setCurrency(currencies[0]);
                        setSortBy(value);
                        setPage(1);
                      }
                    }}
                  >
                    <SelectTrigger id={`${id}-sort`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="costPerResult" disabled={!canRankMoney}>
                        Menor costo por resultado
                      </SelectItem>
                      <SelectItem value="results">Más resultados</SelectItem>
                      <SelectItem value="impressions">Más impresiones Meta</SelectItem>
                      <SelectItem value="clicks">Más clics Meta</SelectItem>
                      <SelectItem value="spend" disabled={!canRankMoney}>
                        Mayor gasto Meta
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canRankMoney ? (
                    <p className="text-xs text-muted-foreground">
                      Elige una moneda o cuenta para comparar costos.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={advertisingSectionHref("/publicidad/conexiones", props.from, props.to, {
                      storeId,
                    })}
                  >
                    Ver conexiones
                  </Link>
                </Button>
                {syncAllowed ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncing || query.isFetching || activeImports.length > 0}
                    onClick={() => void sync()}
                  >
                    <RefreshCw aria-hidden="true" />
                    {syncing ? "Iniciando…" : "Importar historial"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {focusedAdId ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Anuncio seleccionado</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFocusedAdId(undefined);
                  setSelected(null);
                  setPage(1);
                }}
              >
                Ver todos los anuncios
              </Button>
            </div>
          ) : null}
          {catalog.rows.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 py-10 text-center">
                <h3 className="font-semibold">
                  {catalog.accounts.length
                    ? "Sin resultados para esta consulta"
                    : "No hay cuentas de Meta"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {catalog.accounts.length
                    ? "Revisa los filtros y la cobertura. Si tienes permiso, actualiza los resultados del periodo."
                    : "Revisa la conexión y elige las cuentas que quieres consultar."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="min-w-0 pt-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-pressed={moreMetrics}
                    onClick={() => setMoreMetrics(!moreMetrics)}
                  >
                    {moreMetrics ? "Menos métricas" : "Más métricas"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    Exportar página CSV
                  </Button>
                </div>
                {businessFailures.length ? (
                  <Alert
                    className="mb-3"
                    variant={
                      businessFailures.some((source) => source.query.isAccessDenied)
                        ? "destructive"
                        : "default"
                    }
                  >
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                      <p>{advertisingErrorMessage(businessFailures[0].query.error)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={businessFailures.some((source) => source.query.isFetching)}
                        onClick={() => {
                          for (const source of businessFailures) void source.query.refetch();
                        }}
                      >
                        Reintentar datos de Powip
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {moreMetrics ? (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {props.level === "ad"
                      ? "Ventas: fecha de registro. Entregados: fecha de entrega. ROAS: fecha de cobro. Solo pedidos con anuncio confirmado. Meta dice: compras reportadas por Meta."
                      : "Ventas: fecha de registro. Entregados: fecha de entrega. ROAS: fecha de cobro. Solo pedidos con campaña confirmada. CPA plataforma: costo por compra reportada por Meta."}{" "}
                    Leads: reportados por Meta. Devueltos y reparto de pedidos sin anuncio:
                    pendientes.
                  </p>
                ) : null}
                <AdvertisingMetaMetricsTable
                  rows={catalog.rows}
                  level={props.level}
                  title={TITLES[props.level]}
                  resultType={resultType}
                  more={moreMetrics}
                  accountName={(row) =>
                    catalog.accounts.find((account) => account.id === row.accountId)?.name ??
                    "Cuenta Meta"
                  }
                  valuesFor={valuesFor}
                  action={(row) => (
                    <CatalogRowAction
                      row={row}
                      level={props.level}
                      from={props.from}
                      to={props.to}
                      resultType={resultType}
                      onSelect={setSelected}
                    />
                  )}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {catalog.pagination.total} {TITLES[props.level].toLowerCase()} · Página{" "}
                    {catalog.pagination.page}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || query.isFetching}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!catalog.pagination.hasMore || query.isFetching}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Cómo leer estos datos
            </summary>
            <div className="mt-2 space-y-2">
              <p>
                {metaResultCostLabel(resultType)} = gasto ÷{" "}
                {resultType === "messages" ? "conversaciones iniciadas" : "compras por web"}. Sin
                resultados: —.
              </p>
              <p>
                Parcial: el costo aún no está confirmado. No disponible: no hay datos suficientes
                para mostrar este resultado.
              </p>
              <p>
                Estos resultados no equivalen a pedidos, entregas o cobros de Powip. El gasto de
                anuncios no se suma otra vez al Resumen.
              </p>
              <p>
                Fuente: Meta · Atribución de 7 días por clic y 1 día por vista · Zona de cada
                cuenta. Sin conversión de moneda.
              </p>
              {catalog.accounts
                .filter(
                  (account) =>
                    (accountId === "all" || account.id === accountId) &&
                    (currency === "all" || account.currency === currency),
                )
                .map((account) => (
                  <p key={account.id}>
                    {account.name} · Gasto: {metaCoverageLabel(account.coverage)}
                  </p>
                ))}
            </div>
          </details>
        </>
      )}
      {detailRow ? (
        <AdDetail
          {...props}
          resultType={resultType}
          selected={detailRow}
          onClose={() => {
            setSelected(null);
            setFocusedDetailClosed(true);
          }}
        />
      ) : null}
    </section>
  );
}

function CatalogRowAction({
  row,
  level,
  from,
  to,
  resultType,
  onSelect,
}: {
  row: MetaCatalogRow;
  level: MetaCatalogLevel;
  from: string;
  to: string;
  resultType: MetaResultType;
  onSelect: (row: MetaCatalogRow) => void;
}) {
  const { storeId } = useAdvertisingStoreFilter();
  if (level === "ad")
    return (
      <Button size="sm" variant="outline" onClick={() => onSelect(row)}>
        Ver detalle
      </Button>
    );
  return (
    <Button size="sm" variant="outline" asChild>
      <Link
        href={advertisingSectionHref(
          level === "campaign" ? "/publicidad/campanas" : "/publicidad/anuncios",
          from,
          to,
          {
            accountId: row.accountId,
            campaignId: level === "campaign" ? row.id : row.campaignId,
            adsetId: level === "adset" ? row.id : undefined,
            resultType,
            storeId,
          },
        )}
      >
        {level === "campaign" ? "Ver conjuntos" : "Ver anuncios"}
      </Link>
    </Button>
  );
}
