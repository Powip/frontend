"use client";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { formatAdvertisingDecimal } from "./advertising-decimal";
import { isEffectiveAdvertisingSpend } from "./advertising-effective-model";
import { formatAdvertisingDate } from "./advertising-model";

interface Props {
  effective: EffectiveAdvertisingSpendWire;
  from: string;
  to: string;
  showLink?: boolean;
}

const money = (value: string | null, currency: string) =>
  value === null ? "Pendiente" : formatAdvertisingDecimal(value, currency);

export function AdvertisingEffectiveSpend({ effective, from, to, showLink = false }: Props) {
  if (!isEffectiveAdvertisingSpend(effective, from, to)) {
    return (
      <Alert>
        <AlertDescription>
          No pudimos leer el consumo publicitario de este periodo.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-base">Consumo publicitario de la empresa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Del {formatAdvertisingDate(from)} {from.slice(0, 4)} al {formatAdvertisingDate(to)}{" "}
          {to.slice(0, 4)} · zona de cada cuenta
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {effective.totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay cuentas publicitarias para este periodo.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {effective.totals.map((total) => (
              <div key={total.currency} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{total.currency}</span>
                  <Badge variant="outline">
                    {total.coverage === "complete"
                      ? "Importación completa"
                      : total.coverage === "partial"
                        ? "Importación parcial"
                        : "Importación pendiente"}
                  </Badge>
                </div>
                <p className="break-words font-mono text-2xl font-semibold">
                  {money(total.amount, total.currency)}
                </p>
                <dl className="space-y-1 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Importado</dt>
                    <dd className="font-mono">{money(total.importedAmount, total.currency)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Respaldo manual vigente</dt>
                    <dd className="font-mono">{money(total.fallbackAmount, total.currency)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Consumo adicional confirmado</dt>
                    <dd className="font-mono">{money(total.additionalAmount, total.currency)}</dd>
                  </div>
                </dl>
                {total.provisional ? (
                  <p className="text-xs text-muted-foreground">Incluye datos provisionales.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {effective.pendingManualCount > 0 ? (
          <Alert>
            <AlertDescription>
              {effective.pendingManualCount}{" "}
              {effective.pendingManualCount === 1
                ? "registro manual por revisar. No se incluye"
                : "registros manuales por revisar. No se incluyen"}{" "}
              en estos importes.
            </AlertDescription>
          </Alert>
        ) : null}
        {effective.conflictedManualIds.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              Hay respaldos de la misma cuenta y fecha por resolver.
            </AlertDescription>
          </Alert>
        ) : null}
        {showLink ? (
          <Link
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={`/administracion/pauta?from=${from}&to=${to}`}
          >
            Ver inversión y revisar registros
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
