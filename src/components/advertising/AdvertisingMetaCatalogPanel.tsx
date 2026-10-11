"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, RefreshCw } from "lucide-react";
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
  syncMetaModule,
} from "@/services/advertisingMetaService";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import {
  formatMetaNumber,
  formatMetaSpend,
  metaCoverageLabel,
  metaStatusLabel,
  validMetaPeriod,
} from "./advertising-meta-model";
import { formatAdvertisingDate } from "./advertising-model";
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
}

export function AdvertisingMetaCatalogPanel({ initialAccountId, initialAdId, ...props }: Props) {
  const id = useId();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(initialAccountId ?? "all");
  const [focusedAdId, setFocusedAdId] = useState(initialAdId);
  const [focusedDetailClosed, setFocusedDetailClosed] = useState(false);
  const [currency, setCurrency] = useState("all");
  const [sortBy, setSortBy] = useState<"spend" | "clicks" | "impressions">("impressions");
  const [page, setPage] = useState(1);
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
    sortBy,
    sortOrder: "desc",
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
  const canRankSpend = currency !== "all" || accountId !== "all" || currencies.length <= 1;
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
      className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8"
      aria-label={`${TITLES[props.level]} de Meta`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">{TITLES[props.level]}</h2>
          <p className="text-xs text-muted-foreground">
            Resultados de Meta · {formatAdvertisingDate(props.from)} {props.from.slice(0, 4)} al{" "}
            {formatAdvertisingDate(props.to)} {props.to.slice(0, 4)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={advertisingSectionHref("/publicidad/conexiones", props.from, props.to)}>
              Ver conexiones
            </Link>
          </Button>
          {catalog ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!syncAllowed || syncing || query.isFetching || activeImports.length > 0}
              onClick={() => void sync()}
            >
              <RefreshCw aria-hidden="true" />
              {syncing ? "Iniciando…" : "Importar historial"}
            </Button>
          ) : null}
        </div>
      </div>
      {props.campaignId ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={advertisingSectionHref("/publicidad/campanas", props.from, props.to)}
          >
            Todas las campañas
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="break-all">Campaña {props.campaignId}</span>
          {props.adsetId ? (
            <>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span className="break-all">Conjunto {props.adsetId}</span>
            </>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Estos resultados no equivalen a pedidos, entregas o cobros de Powip. El gasto de anuncios no
        se suma otra vez al Resumen.
      </p>
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
                    ? "Reintentando"
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
                  if (sortBy === "spend") setSortBy("impressions");
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
                  if (value === "all" && sortBy === "spend") setSortBy("impressions");
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
                    (value === "spend" && canRankSpend)
                  ) {
                    setSortBy(value);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger id={`${id}-sort`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Más impresiones Meta</SelectItem>
                  <SelectItem value="clicks">Más clics Meta</SelectItem>
                  <SelectItem value="spend" disabled={!canRankSpend}>
                    Mayor gasto Meta
                  </SelectItem>
                </SelectContent>
              </Select>
              {!canRankSpend ? (
                <p className="text-xs text-muted-foreground">
                  Elige una moneda o cuenta para ordenar por gasto.
                </p>
              ) : null}
            </div>
          </div>
          {focusedAdId ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Anuncio {focusedAdId}</span>
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
          {catalog.accounts.length ? (
            <div className="flex flex-wrap gap-2">
              {catalog.accounts
                .filter((account) => accountId === "all" || account.id === accountId)
                .map((account) => (
                  <Badge key={account.id} variant="outline">
                    {account.name} · {metaCoverageLabel(account.coverage)}
                  </Badge>
                ))}
            </div>
          ) : null}
          {!catalog.capabilities.canSync ? (
            <p className="text-xs text-muted-foreground">
              Necesitas permiso de gestión para actualizar resultados.
            </p>
          ) : !syncAllowed ? (
            <p className="text-xs text-muted-foreground">
              Elige una cuenta activa en Conexiones para actualizar resultados.
            </p>
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
                      <TableHead>Estado Meta</TableHead>
                      <TableHead className="text-right">Gasto Meta</TableHead>
                      <TableHead className="text-right">Impresiones</TableHead>
                      <TableHead className="text-right">Clics</TableHead>
                      <TableHead>Datos</TableHead>
                      <TableHead>
                        <span className="sr-only">Consultar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalog.rows.map((row) => (
                      <TableRow key={`${row.accountId}:${row.id}`}>
                        <TableCell className="min-w-44">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID {row.id} · {row.currency}
                          </p>
                        </TableCell>
                        <TableCell>{metaStatusLabel(row.effectiveStatus)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                          {formatMetaSpend(row.insights.spend, row.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMetaNumber(row.insights.impressions)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMetaNumber(row.insights.clicks)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {metaCoverageLabel(row.insights.coverage)}
                          </Badge>
                          {row.insights.coverage.provisionalDays ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Incluye días provisionales
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {props.level === "ad" ? (
                            <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                              Ver detalle
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={advertisingSectionHref(
                                  props.level === "campaign"
                                    ? "/publicidad/campanas"
                                    : "/publicidad/anuncios",
                                  props.from,
                                  props.to,
                                  {
                                    accountId: row.accountId,
                                    campaignId:
                                      props.level === "campaign" ? row.id : row.campaignId,
                                    adsetId: props.level === "adset" ? row.id : undefined,
                                  },
                                )}
                              >
                                {props.level === "campaign" ? "Ver conjuntos" : "Ver anuncios"}
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {catalog.pagination.total} resultados · Página {catalog.pagination.page}
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
          <p className="text-xs text-muted-foreground">
            Fuente: Meta · Atribución de 7 días por clic y 1 día por vista · Zona de cada cuenta.
            Sin conversión de moneda.
          </p>
        </>
      )}
      {detailRow ? (
        <AdDetail
          {...props}
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
