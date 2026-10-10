"use client";

import { CircleAlert, CircleCheck, Megaphone, Pause, Plug, RotateCw } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvertisingManualReview } from "./AdvertisingManualReview";
import {
  type AdvertisingProvider,
  type AdvertisingSnapshot,
  formatAdvertisingDate,
  formatAdvertisingMoney,
  getAdvertisingSummary,
  isAdvertisingZero,
  providerLabel,
} from "./advertising-model";

const SpendChart = dynamic(() => import("./AdvertisingSpendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

export interface AdvertisingActions {
  onConnect?: (provider: AdvertisingProvider) => void;
  onManage?: (provider: AdvertisingProvider) => void;
  onReconnect?: (provider: AdvertisingProvider) => void;
  onPause?: (provider: AdvertisingProvider) => void;
}

interface AdvertisingDashboardProps extends AdvertisingActions {
  companyName: string;
  from: string;
  to: string;
  snapshot: AdvertisingSnapshot;
  manualContent?: ReactNode;
  manualReviewContent?: ReactNode;
  effectiveContent?: ReactNode;
  isDemo?: boolean;
  onResolveManual?: (recordId: string, accountId: string) => void;
  onReopenManual?: (recordId: string) => void;
}

const PROVIDERS: AdvertisingProvider[] = ["meta", "tiktok"];
const STATUS_LABELS = {
  connected: "Conectada",
  disconnected: "Sin conexión",
  "needs-auth": "Reconexión pendiente",
  paused: "Actualizaciones pausadas",
};

export function AdvertisingConnections({
  snapshot,
  onConnect,
  onManage,
  onReconnect,
  onPause,
}: { snapshot: AdvertisingSnapshot } & AdvertisingActions) {
  const [pauseProvider, setPauseProvider] = useState<AdvertisingProvider | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const connection = snapshot.providers[provider];
          const accounts = snapshot.accounts.filter((account) => account.provider === provider);
          const enabled = accounts.filter((account) => account.enabled);
          const needsAuth = connection.status === "needs-auth";
          const canManage = connection.status === "connected" || connection.status === "paused";
          const action = needsAuth ? onReconnect : canManage ? onManage : onConnect;
          return (
            <Card key={provider}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="size-4 text-primary" aria-hidden="true" />
                    {providerLabel(provider)}
                  </CardTitle>
                  <Badge variant={canManage ? "secondary" : "outline"}>
                    {connection.available ? STATUS_LABELS[connection.status] : "Próximamente"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {connection.available
                    ? `${enabled.length} ${enabled.length === 1 ? "cuenta activa" : "cuentas activas"} · ${accounts.length} con datos guardados`
                    : "Consulta el gasto de tus anuncios en Powip."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!connection.available || !action}
                    onClick={() => action?.(provider)}
                  >
                    {needsAuth ? <RotateCw aria-hidden="true" /> : <Plug aria-hidden="true" />}
                    {needsAuth ? "Reconectar" : canManage ? "Elegir cuentas" : "Conectar"}
                  </Button>
                  {connection.available && enabled.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!onPause}
                      onClick={() => setPauseProvider(provider)}
                    >
                      <Pause aria-hidden="true" />
                      Pausar actualizaciones
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <AlertDialog
        open={pauseProvider !== null}
        onOpenChange={(open) => {
          if (!open) setPauseProvider(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Pausar {pauseProvider ? providerLabel(pauseProvider) : "actualizaciones"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dejarás de recibir nuevos datos. Podrás ver los gastos anteriores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pauseProvider) onPause?.(pauseProvider);
                setPauseProvider(null);
              }}
            >
              Pausar actualizaciones
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AdvertisingDashboard({
  companyName,
  from,
  to,
  snapshot,
  manualContent,
  manualReviewContent,
  effectiveContent,
  isDemo = false,
  onResolveManual,
  onReopenManual,
  ...actions
}: AdvertisingDashboardProps) {
  const id = useId();
  const [view, setView] = useState("investment");
  const [provider, setProvider] = useState<"all" | AdvertisingProvider>("all");
  const [accountId, setAccountId] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [showPending, setShowPending] = useState(false);
  const summary = useMemo(
    () => getAdvertisingSummary(snapshot, { from, to, provider, accountId, currency }),
    [snapshot, from, to, provider, accountId, currency],
  );
  const currencies = [...new Set(snapshot.accounts.map((account) => account.currency))];
  const pending = summary.accounts.filter((item) => !item.complete);
  const reconnect = PROVIDERS.filter(
    (item) =>
      snapshot.providers[item].status === "needs-auth" &&
      summary.accounts.some(({ account }) => account.provider === item),
  );
  const pendingManual = snapshot.manualRecords.filter(
    (record) => record.status === "pending" && record.date >= from && record.date <= to,
  );
  const lastUpdate = summary.accounts
    .map(({ account }) => account.updatedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  function clearFilters() {
    setProvider("all");
    setAccountId("all");
    setCurrency("all");
  }

  return (
    <section className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8" aria-label="Inversión publicitaria">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Inversión publicitaria</h2>
          <p className="text-xs text-muted-foreground">{companyName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDemo ? <Badge variant="outline">Datos de ejemplo</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => setView("connections")}>
            <Plug aria-hidden="true" />
            Ver cuentas
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView} className="gap-6">
        <TabsList aria-label="Publicidad" className="grid h-auto w-full max-w-md grid-cols-3">
          <TabsTrigger value="investment" className="min-h-9 whitespace-normal">
            Inversión
          </TabsTrigger>
          <TabsTrigger value="connections" className="min-h-9 whitespace-normal">
            Conexiones
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-h-9 whitespace-normal">
            Gastos manuales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="investment" className="min-w-0 space-y-6">
          {effectiveContent}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-provider`}>Plataforma</Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  if (value === "all" || value === "meta" || value === "tiktok") setProvider(value);
                  setAccountId("all");
                }}
              >
                <SelectTrigger id={`${id}-provider`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {PROVIDERS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {providerLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`${id}-currency`}>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id={`${id}-currency`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {currencies.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === "PEN" ? "Soles (PEN)" : item === "USD" ? "Dólares (USD)" : item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor={`${id}-account`}>Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id={`${id}-account`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {snapshot.accounts
                    .filter((account) => provider === "all" || account.provider === provider)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.enabled ? "" : " · pausada"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {snapshot.accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Megaphone className="size-8 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">Sin cuentas conectadas</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {PROVIDERS.some((item) => snapshot.providers[item].available)
                    ? "Elige tus cuentas para consultar el gasto."
                    : "Meta Ads y TikTok Ads estarán disponibles próximamente."}
                </p>
                <Button size="sm" onClick={() => setView("connections")}>
                  Ver conexiones
                </Button>
              </CardContent>
            </Card>
          ) : summary.accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-8">
                <p className="text-sm text-muted-foreground">Sin cuentas para estos filtros.</p>
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Ver todas las cuentas
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2" aria-live="polite" aria-atomic="true">
                {summary.totals.map((total) => (
                  <Card key={total.currency}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {total.complete ? "Gasto" : "Gasto disponible"} · {total.currency}
                        </h3>
                        <Badge variant="outline">
                          {total.complete ? (
                            <CircleCheck aria-hidden="true" />
                          ) : (
                            <CircleAlert aria-hidden="true" />
                          )}
                          {total.complete ? "Datos completos" : "Datos parciales"}
                        </Badge>
                      </div>
                      <p className="font-mono text-2xl font-bold tabular-nums">
                        {formatAdvertisingMoney(
                          total.amountMinor,
                          total.currency,
                          total.amountDecimal,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {total.accountCount} {total.accountCount === 1 ? "cuenta" : "cuentas"}
                        {total.complete && isAdvertisingZero(total.amountMinor, total.amountDecimal)
                          ? " · cero confirmado"
                          : ""}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {pending.length > 0 ? (
                <Alert role="status">
                  <CircleAlert aria-hidden="true" />
                  <AlertDescription>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <p>
                        Faltan datos de {pending.map(({ account }) => account.name).join(", ")}.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPending((value) => !value)}
                        aria-expanded={showPending}
                      >
                        {showPending ? "Ocultar detalle" : "Ver detalle"}
                      </Button>
                    </div>
                    {showPending ? (
                      <ul className="space-y-1">
                        {pending.map(({ account, missingDates }) => (
                          <li key={account.id}>
                            {account.name}: {missingDates.map(formatAdvertisingDate).join(", ")}{" "}
                            pendientes.
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              {reconnect.map((item) => (
                <Alert key={item} role="status">
                  <RotateCw aria-hidden="true" />
                  <AlertDescription>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <p>Reconecta {providerLabel(item)} para recibir nuevos datos.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!actions.onReconnect}
                        onClick={() => actions.onReconnect?.(item)}
                      >
                        Reconectar
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}

              <div className="space-y-1 text-xs text-muted-foreground">
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
                {summary.totals.length > 1 ? <p>Las monedas se muestran por separado.</p> : null}
              </div>

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
                  <div className="space-y-4 sm:hidden">
                    {summary.accounts.map(
                      ({ account, amountMinor, amountDecimal, complete, missingDates }) => (
                        <div
                          key={account.id}
                          className="space-y-2 border-b pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 break-words text-sm font-semibold">
                              {account.name}
                            </p>
                            <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                              {formatAdvertisingMoney(amountMinor, account.currency, amountDecimal)}
                            </p>
                          </div>
                          <p className="break-words text-xs text-muted-foreground">
                            {providerLabel(account.provider)} · ID {account.externalId}
                            <br />
                            {account.currency} · {account.timeZone}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {complete
                                ? "Datos completos"
                                : `${missingDates.length} ${missingDates.length === 1 ? "día pendiente" : "días pendientes"}`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {snapshot.providers[account.provider].status === "needs-auth"
                                ? "Reconectar"
                                : account.enabled
                                  ? "Actualizaciones activas"
                                  : "Actualizaciones pausadas"}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <Table aria-label="Gasto por cuenta publicitaria">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cuenta y plataforma</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead>Datos del periodo</TableHead>
                          <TableHead>Actualizaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.accounts.map(
                          ({ account, amountMinor, amountDecimal, complete, missingDates }) => (
                            <TableRow key={account.id}>
                              <TableCell>
                                <span className="font-semibold">{account.name}</span>
                                <div className="text-xs text-muted-foreground">
                                  {providerLabel(account.provider)} · ID {account.externalId}
                                  <br />
                                  {account.currency} · {account.timeZone}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatAdvertisingMoney(
                                  amountMinor,
                                  account.currency,
                                  amountDecimal,
                                )}
                              </TableCell>
                              <TableCell>
                                {complete
                                  ? "Datos completos"
                                  : `${missingDates.length} ${missingDates.length === 1 ? "día pendiente" : "días pendientes"}`}
                              </TableCell>
                              <TableCell>
                                {snapshot.providers[account.provider].status === "needs-auth"
                                  ? "Reconectar"
                                  : account.enabled
                                    ? "Activas"
                                    : "Pausadas"}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {pendingManual.length > 0 ? (
            <Alert role="status">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <p>
                    {pendingManual.length}{" "}
                    {pendingManual.length === 1
                      ? "gasto manual por revisar"
                      : "gastos manuales por revisar"}
                    {pendingManual.length === 1
                      ? ". Aún no se suma al total."
                      : ". Aún no se suman al total."}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setView("manual")}>
                    Revisar gastos
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <AdvertisingConnections snapshot={snapshot} {...actions} />
        </TabsContent>
        <TabsContent value="manual" className="min-w-0">
          {manualReviewContent ?? manualContent ?? (
            <AdvertisingManualReview
              snapshot={snapshot}
              isDemo={isDemo}
              onResolve={onResolveManual}
              onReopen={onReopenManual}
            />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
