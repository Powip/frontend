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
import { AdvertisingAccountHistory } from "./AdvertisingAccountHistory";
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

const SpendChart = dynamic(() => import("./AdvertisingSpendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});
const PROVIDERS: AdvertisingProvider[] = ["meta", "tiktok"];

function outsideHistory(account: AdvertisingAccount, to: string) {
  return !!account.historyImport?.availableFrom && to < account.historyImport.availableFrom;
}

interface Props {
  companyName: string;
  from: string;
  to: string;
  snapshot: AdvertisingSnapshot;
  effectiveContent?: ReactNode;
  manualReviewContent?: ReactNode;
}

export function AdvertisingModuleSummary({
  companyName,
  from,
  to,
  snapshot,
  effectiveContent,
  manualReviewContent,
}: Props) {
  const id = useId();
  const [provider, setProvider] = useState<"all" | AdvertisingProvider>("all");
  const [currency, setCurrency] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [showManual, setShowManual] = useState(false);
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
        <Button size="sm" variant="outline" asChild>
          <Link href="/publicidad/conexiones">
            <Plug aria-hidden="true" />
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
              {snapshot.accounts.length
                ? "Sin cuentas para estos filtros"
                : "Conecta tu cuenta de publicidad"}
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {snapshot.accounts.length
                ? "Cambia los filtros para consultar otras cuentas."
                : "Elige tus cuentas de Meta para importar todo el historial disponible."}
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
