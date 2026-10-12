"use client";

import { CircleAlert, Megaphone, Plug } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import { useAdvertisingSummaryV11 } from "@/hooks/useAdvertisingV11";
import { advertisingErrorMessage, advertisingErrorStatus } from "@/services/advertisingService";
import type { AdvertisingSeriesBy } from "@/services/advertisingV11Service";
import { AdvertisingAccountHistory } from "./AdvertisingAccountHistory";
import { AdvertisingStackedSpendChart } from "./AdvertisingStackedSpendChart";
import { useAdvertisingStoreFilter } from "./AdvertisingStoreFilterContext";
import { AdvertisingSummaryCards } from "./AdvertisingSummaryCards";
import { AdvertisingWholeBusinessCard } from "./AdvertisingWholeBusinessCard";
import { formatAdvertisingMetric } from "./advertising-business-metrics-model";
import { formatMetaSpend } from "./advertising-meta-model";
import {
  type AdvertisingAccount,
  type AdvertisingProvider,
  type AdvertisingSnapshot,
  formatAdvertisingDate,
  formatAdvertisingMoney,
  getAdvertisingSummary,
  hasAdvertisingAmount,
  providerLabel,
} from "./advertising-model";
import { advertisingSectionHref } from "./advertising-sections";

const SpendChart = dynamic(() => import("./AdvertisingSpendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});
const PROVIDERS: AdvertisingProvider[] = ["meta", "tiktok"];

function outsideHistory(account: AdvertisingAccount, to: string) {
  return !!account.historyImport?.availableFrom && to < account.historyImport.availableFrom;
}

interface Props {
  token?: string | null;
  actorId?: string | null;
  companyId?: string | null;
  companyName: string;
  from: string;
  to: string;
  snapshot: AdvertisingSnapshot;
  canManage?: boolean;
  effectiveContent?: ReactNode;
  manualReviewContent?: ReactNode;
}

function emptyAccountsMessage(
  connection: AdvertisingSnapshot["providers"]["meta"],
  canManage: boolean,
) {
  if (!connection.available)
    return {
      title: "Publicidad aún no disponible",
      description: "La conexión con Meta aún no está habilitada.",
    };

  const connected = connection.status === "connected" || connection.status === "paused";
  const needsAuth = connection.status === "needs-auth";
  if (!canManage) {
    const action = connected
      ? "elegir las cuentas"
      : needsAuth
        ? "reconectar Meta y elegir las cuentas"
        : "conectar Meta y elegir las cuentas";
    return {
      title: "Sin cuentas publicitarias",
      description: `Quien gestiona publicidad debe ${action}.`,
    };
  }
  if (connected)
    return {
      title: "Elige tus cuentas publicitarias",
      description: "Importa todo el historial disponible de tus cuentas de Meta.",
    };
  if (needsAuth)
    return {
      title: "Reconecta Meta Ads",
      description: "Vuelve a conectar Meta para importar el historial disponible.",
    };
  return {
    title: "Conecta Meta Ads",
    description: "Importa todo el historial disponible de tus cuentas publicitarias.",
  };
}

export function AdvertisingModuleSummary(props: Props) {
  return props.token && props.actorId && props.companyId && props.snapshot.accounts.length ? (
    <AdvertisingModuleSummaryV11 {...props} />
  ) : (
    <AdvertisingImportedModuleSummary {...props} />
  );
}

function AdvertisingImportedModuleSummary({
  companyName,
  from,
  to,
  snapshot,
  canManage = false,
  effectiveContent,
  manualReviewContent,
}: Props) {
  const id = useId();
  const [provider, setProvider] = useState<"all" | AdvertisingProvider>("all");
  const [currency, setCurrency] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [showManual, setShowManual] = useState(false);
  const emptyMessage = emptyAccountsMessage(snapshot.providers.meta, canManage);
  const summary = useMemo(
    () => getAdvertisingSummary(snapshot, { from, to, provider, currency, accountId }),
    [snapshot, from, to, provider, currency, accountId],
  );
  const availableProviders = PROVIDERS.filter(
    (item) =>
      snapshot.providers[item].available ||
      snapshot.accounts.some((account) => account.provider === item),
  );
  const currencies = [...new Set(snapshot.accounts.map((account) => account.currency))];
  const pending = summary.accounts.filter(
    (item) => !item.complete && !(!hasAdvertisingAmount(item) && outsideHistory(item.account, to)),
  );
  const activeHistory = summary.accounts.filter(
    ({ account }) => account.historyImport && account.historyImport.status !== "succeeded",
  );
  const lastUpdate = summary.accounts
    .map(({ account }) => account.updatedAt)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1);

  return (
    <section className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8" aria-label="Resumen de publicidad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Estadísticas</h2>
          <p className="text-xs text-muted-foreground">
            {companyName} · {formatAdvertisingDate(from)} {from.slice(0, 4)} al{" "}
            {formatAdvertisingDate(to)} {to.slice(0, 4)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={advertisingSectionHref("/publicidad/campanas", from, to)}>
              Ver campañas
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={advertisingSectionHref("/publicidad/anuncios", from, to)}>
              Ver anuncios
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={advertisingSectionHref("/publicidad/conexiones", from, to)}>
              <Plug aria-hidden="true" />
              Ver cuentas
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-platform`}>Plataforma</Label>
          <Select
            value={provider}
            onValueChange={(value) => {
              if (value === "all" || value === "meta" || value === "tiktok") setProvider(value);
              setAccountId("all");
            }}
          >
            <SelectTrigger id={`${id}-platform`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plataformas</SelectItem>
              {availableProviders.map((item) => (
                <SelectItem key={item} value={item}>
                  {providerLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-account`}>Cuenta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={`${id}-account`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {snapshot.accounts
                .filter((account) => provider === "all" || account.provider === provider)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-currency`}>Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id={`${id}-currency`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {currencies.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "PEN" ? "Soles (PEN)" : item === "USD" ? "Dólares (USD)" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary.accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Megaphone className="size-8 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">
              {snapshot.accounts.length ? "Sin cuentas para estos filtros" : emptyMessage.title}
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {snapshot.accounts.length
                ? "Cambia los filtros para consultar otras cuentas."
                : emptyMessage.description}
            </p>
            {snapshot.accounts.length ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setProvider("all");
                  setAccountId("all");
                  setCurrency("all");
                }}
              >
                Ver todas las cuentas
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/publicidad/conexiones">Ver conexiones</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
            {summary.totals.map((total) => {
              const unavailable = summary.accounts
                .filter(({ account }) => account.currency === total.currency)
                .every((item) => !hasAdvertisingAmount(item) && outsideHistory(item.account, to));
              return (
                <Card key={total.currency}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">Gasto importado · {total.currency}</h3>
                      <Badge variant="outline">
                        {unavailable
                          ? "Fuera del historial"
                          : total.complete
                            ? "Datos completos"
                            : "Datos parciales"}
                      </Badge>
                    </div>
                    <p className="font-mono text-3xl font-semibold tabular-nums">
                      {unavailable && !hasAdvertisingAmount(total)
                        ? "—"
                        : formatAdvertisingMoney(
                            total.amountMinor,
                            total.currency,
                            total.amountDecimal,
                          )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {total.accountCount}{" "}
                      {total.accountCount === 1 ? "cuenta publicitaria" : "cuentas publicitarias"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {activeHistory.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Importación del historial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeHistory.map((item) => (
                  <AdvertisingAccountHistory
                    key={item.account.id}
                    account={item.account}
                    from={from}
                    to={to}
                    hasStoredData={hasAdvertisingAmount(item)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
          {pending.length ? (
            <Alert role="status">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                Faltan datos de {pending.map(({ account }) => account.name).join(", ")}. El total
                incluye solo el gasto disponible.
              </AlertDescription>
            </Alert>
          ) : null}
          {summary.totals.map((total) => (
            <SpendChart
              key={total.currency}
              currency={total.currency}
              days={summary.daily[total.currency] ?? []}
              today={snapshot.today}
            />
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por cuenta</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <Table aria-label="Gasto por cuenta publicitaria">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead>Datos del periodo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.accounts.map(
                    ({ account, amountMinor, amountDecimal, complete, missingDates }) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID {account.externalId} · {account.currency}
                          </p>
                        </TableCell>
                        <TableCell>{providerLabel(account.provider)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {outsideHistory(account, to) &&
                          !hasAdvertisingAmount({ amountMinor, amountDecimal })
                            ? "—"
                            : formatAdvertisingMoney(amountMinor, account.currency, amountDecimal)}
                        </TableCell>
                        <TableCell>
                          {complete
                            ? "Datos completos"
                            : !hasAdvertisingAmount({ amountMinor, amountDecimal }) &&
                                outsideHistory(account, to)
                              ? "Fuera del historial disponible"
                              : `${missingDates.length} ${missingDates.length === 1 ? "día pendiente" : "días pendientes"}`}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Fechas según la zona horaria de cada cuenta. Las monedas se muestran por separado.
            </p>
            {from <= snapshot.today && to >= snapshot.today ? (
              <p>El gasto de hoy puede cambiar.</p>
            ) : null}
            {lastUpdate ? (
              <p>
                Actualizado:{" "}
                {new Intl.DateTimeFormat("es-PE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Lima",
                }).format(new Date(lastUpdate))}{" "}
                · hora de Perú
              </p>
            ) : null}
          </div>
        </>
      )}
      {effectiveContent || manualReviewContent ? (
        <details
          className="rounded-lg border border-border bg-card"
          onToggle={(event) => setShowManual(event.currentTarget.open)}
        >
          <summary className="cursor-pointer p-4 text-sm font-medium text-primary">
            Consumo total y gastos manuales
          </summary>
          {showManual ? (
            <div className="space-y-4 p-4 pt-0">
              {effectiveContent}
              {manualReviewContent}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}

function AdvertisingModuleSummaryV11({
  token,
  actorId,
  companyId,
  from,
  to,
  companyName,
  snapshot,
  effectiveContent,
  manualReviewContent,
}: Props) {
  const id = useId();
  const { storeId, stores } = useAdvertisingStoreFilter();
  const [accountId, setAccountId] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [seriesBy, setSeriesBy] = useState<AdvertisingSeriesBy>(
    stores.length > 1 ? "store" : "account",
  );
  const [provider, setProvider] = useState<"all" | AdvertisingProvider>("all");
  const identity = { token, actorId, companyId };
  const filters = {
    from,
    to,
    storeId,
    accountId: accountId === "all" ? undefined : accountId,
    currency: currency === "all" ? undefined : currency,
    seriesBy,
    provider: provider === "all" ? undefined : provider,
  };
  const query = useAdvertisingSummaryV11(identity, filters);
  const global = useAdvertisingSummaryV11(
    { ...identity, enabled: storeId !== "none" },
    { from, to, storeId, seriesBy: "account" },
  );
  const business = useAdvertisingBusinessMetrics(identity, {
    from,
    to,
    storeId,
    channelId: "all",
    basis: "delivered",
    timeZone: "America/Lima",
  });
  const summary = query.data;
  const currencies = [...new Set(snapshot.accounts.map((account) => account.currency))];
  const storeName = stores.find((store) => store.id === storeId)?.name;
  return (
    <section className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8" aria-label="Resumen de publicidad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Estadísticas</h2>
          <p className="text-xs text-muted-foreground">
            {companyName} · {formatAdvertisingDate(from)} al {formatAdvertisingDate(to)}
            {storeName
              ? ` · ${storeName}`
              : storeId === "none"
                ? " · gasto sin asignar"
                : " · todas las tiendas"}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={advertisingSectionHref("/publicidad/conexiones", from, to, { storeId })}>
            Ver cuentas
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-platform`}>Plataforma</Label>
          <Select
            value={provider}
            onValueChange={(value) => {
              if (value === "all" || value === "meta" || value === "tiktok") setProvider(value);
              setAccountId("all");
            }}
          >
            <SelectTrigger id={`${id}-platform`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plataformas</SelectItem>
              <SelectItem value="meta">Meta Ads</SelectItem>
              {snapshot.accounts.some((account) => account.provider === "tiktok") ? (
                <SelectItem value="tiktok">TikTok · registros anteriores</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Integración con TikTok pendiente.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-account`}>Cuenta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={`${id}-account`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {snapshot.accounts
                .filter((account) => provider === "all" || account.provider === provider)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-currency`}>Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id={`${id}-currency`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {currencies.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.isError ? (
        <Alert variant={query.isAccessDenied ? "destructive" : "default"}>
          <AlertDescription>
            <p>
              {[404, 503].includes(advertisingErrorStatus(query.error) ?? 0)
                ? "El resumen por tienda aún no está disponible."
                : advertisingErrorMessage(query.error)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void query.refetch()}
            >
              Volver a intentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !summary ? (
        <Skeleton className="h-60" aria-label="Cargando resumen de publicidad" />
      ) : (
        <>
          {summary.currencies.some(
            (total) =>
              /^\d+(?:\.\d+)?$/.test(total.unassignedSpend) && /[1-9]/.test(total.unassignedSpend),
          ) ? (
            <Alert>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Gasto sin tienda:{" "}
                  {summary.currencies
                    .filter(
                      (total) =>
                        /^\d+(?:\.\d+)?$/.test(total.unassignedSpend) &&
                        /[1-9]/.test(total.unassignedSpend),
                    )
                    .map((total) => formatMetaSpend(total.unassignedSpend, total.currency))
                    .join(" · ")}
                  .
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={advertisingSectionHref("/publicidad/asignaciones", from, to, { storeId })}
                  >
                    Asignar tienda
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {summary.currencies.length ? (
            <AdvertisingSummaryCards
              summary={summary}
              business={business.data}
              accountSelected={accountId !== "all" || provider !== "all"}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin gasto disponible para estos filtros.
              </CardContent>
            </Card>
          )}
          {summary.currencies.some((total) => total.coverage !== "complete") ? (
            <Alert>
              <AlertDescription>
                Hay datos pendientes. El gasto incluye solo importes disponibles.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Gasto diario</h3>
            <fieldset aria-label="Agrupar gasto diario" className="flex flex-wrap gap-1">
              {(
                [
                  ["store", "Por tienda"],
                  ["account", "Por cuenta"],
                  ["objective", "Por objetivo"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={seriesBy === value ? "default" : "outline"}
                  aria-pressed={seriesBy === value}
                  onClick={() => setSeriesBy(value)}
                >
                  {label}
                </Button>
              ))}
            </fieldset>
          </div>
          {summary.currencies.map((total) => (
            <AdvertisingStackedSpendChart key={total.currency} summary={summary} total={total} />
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por cuenta</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <Table aria-label="Indicadores por cuenta">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead>Costo por resultado</TableHead>
                    <TableHead className="text-right">CTR de enlace</TableHead>
                    <TableHead className="text-right">Frecuencia</TableHead>
                    <TableHead>Costo por entregado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.byAccount.map((account) => (
                    <TableRow key={account.accountId}>
                      <TableCell>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.provider === "tiktok" ? "TikTok · registro previo" : "Meta"} ·{" "}
                          {account.currency}
                        </p>
                      </TableCell>
                      <TableCell>
                        {account.mode === "multi"
                          ? "Varias tiendas"
                          : account.storeId
                            ? (stores.find((store) => store.id === account.storeId)?.name ??
                              "Tienda anterior")
                            : "Sin asignar"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMetaSpend(account.spend, account.currency)}
                      </TableCell>
                      <TableCell>
                        {account.costPerResult.map((result) => (
                          <p
                            key={`${result.type}:${result.resultType ?? result.label}`}
                            className="text-xs"
                          >
                            {result.label}:{" "}
                            {result.status === "complete"
                              ? formatMetaSpend(result.costPerResult, account.currency)
                              : "Pendiente"}
                          </p>
                        ))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAdvertisingMetric(account.ctr, " %")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAdvertisingMetric(account.frequency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Pedidos de la cuenta por confirmar
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {storeId === "none" ? (
            <p className="text-xs text-muted-foreground">
              El gasto sin asignar se consulta aparte; no se compara con ventas de una tienda.
            </p>
          ) : business.isError || global.isError ? (
            <p role="status" className="text-sm text-muted-foreground">
              Los resultados del negocio están pendientes.{" "}
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  void business.refetch();
                  void global.refetch();
                }}
              >
                Volver a consultar
              </Button>
            </p>
          ) : business.data && global.data ? (
            <AdvertisingWholeBusinessCard
              business={business.data}
              summary={global.data}
              storeName={storeName}
            />
          ) : (
            <Skeleton className="h-32" aria-label="Cargando resultados del negocio" />
          )}
          <p className="text-xs text-muted-foreground">
            Las monedas se muestran por separado. CTR y frecuencia corresponden al periodo completo
            de Meta.
          </p>
        </>
      )}
      {!query.isAccessDenied && (effectiveContent || manualReviewContent) ? (
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-ring">
            Consumo total y gastos manuales
          </summary>
          <div className="space-y-5 border-t border-border p-4">
            {effectiveContent}
            {manualReviewContent}
          </div>
        </details>
      ) : null}
    </section>
  );
}
