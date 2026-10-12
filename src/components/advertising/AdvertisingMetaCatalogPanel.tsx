"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import {
  type MetaCatalogLevel,
  type MetaCatalogRow,
  type MetaCatalogSort,
  type MetaResultType,
  syncMetaModule,
} from "@/services/advertisingMetaService";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import {
  formatMetaCostPerResult,
  formatMetaResultCount,
  formatMetaSpend,
  metaCoverageLabel,
  metaResultAvailabilityLabel,
  metaResultCostLabel,
  metaResultCountLabel,
  validMetaPeriod,
} from "./advertising-meta-model";
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
  });
  const catalog = query.data;
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
            href={advertisingSectionHref("/publicidad/campanas", props.from, props.to)}
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
                    href={advertisingSectionHref("/publicidad/conexiones", props.from, props.to)}
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
                <div className="hidden md:block">
                  <Table aria-label={TITLES[props.level]}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {props.level === "campaign"
                            ? "Campaña"
                            : props.level === "adset"
                              ? "Conjunto"
                              : "Anuncio"}
                        </TableHead>
                        <TableHead className="text-right">
                          {metaResultCostLabel(resultType)}
                        </TableHead>
                        <TableHead className="text-right">
                          {metaResultCountLabel(resultType)}
                        </TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead>Disponibilidad</TableHead>
                        <TableHead>
                          <span className="sr-only">Consultar</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalog.rows.map((row) => (
                        <TableRow key={`${row.accountId}:${row.id}`}>
                          <TableCell className="max-w-72 whitespace-normal">
                            <p className="font-medium break-words">{row.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {
                                catalog.accounts.find((account) => account.id === row.accountId)
                                  ?.name
                              }{" "}
                              · {row.currency}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                            {formatMetaCostPerResult(
                              row.insights.resultMetrics?.[resultType],
                              row.currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatMetaResultCount(row.insights.resultMetrics?.[resultType])}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {formatMetaSpend(row.insights.spend, row.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {metaResultAvailabilityLabel(
                                row.insights.resultMetrics?.[resultType],
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <CatalogRowAction
                              row={row}
                              level={props.level}
                              from={props.from}
                              to={props.to}
                              resultType={resultType}
                              onSelect={setSelected}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul aria-label={`${TITLES[props.level]} en móvil`} className="space-y-3 md:hidden">
                  {catalog.rows.map((row) => (
                    <li
                      key={`${row.accountId}:${row.id}`}
                      className="min-w-0 space-y-3 border-b border-border pb-3 last:border-0"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium break-words">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {catalog.accounts.find((account) => account.id === row.accountId)?.name} ·{" "}
                          {row.currency}
                        </p>
                      </div>
                      <dl className="grid min-w-0 grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <dt className="min-h-8 text-xs text-muted-foreground">
                            {metaResultCostLabel(resultType)}
                          </dt>
                          <dd className="break-words text-base font-semibold tabular-nums">
                            {formatMetaCostPerResult(
                              row.insights.resultMetrics?.[resultType],
                              row.currency,
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="min-h-8 text-xs text-muted-foreground">
                            {metaResultCountLabel(resultType)}
                          </dt>
                          <dd className="break-words text-base font-semibold tabular-nums">
                            {formatMetaResultCount(row.insights.resultMetrics?.[resultType])}
                          </dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Gasto: {formatMetaSpend(row.insights.spend, row.currency)}
                        </span>
                        <Badge variant="outline">
                          {metaResultAvailabilityLabel(row.insights.resultMetrics?.[resultType])}
                        </Badge>
                        <CatalogRowAction
                          row={row}
                          level={props.level}
                          from={props.from}
                          to={props.to}
                          resultType={resultType}
                          onSelect={setSelected}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
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
          },
        )}
      >
        {level === "campaign" ? "Ver conjuntos" : "Ver anuncios"}
      </Link>
    </Button>
  );
}
