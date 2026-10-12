"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import { useAdvertisingSummaryV11 } from "@/hooks/useAdvertisingV11";
import { advertisingErrorMessage } from "@/services/advertisingService";
import { AdvertisingWholeBusinessCard } from "./AdvertisingWholeBusinessCard";
import { formatMetaSpend } from "./advertising-meta-model";

export function AdvertisingBusinessMetricsPanel({
  from,
  to,
  storeId = "all",
  storeName,
}: {
  from: string;
  to: string;
  storeId?: string;
  storeName?: string;
}) {
  const { auth } = useAuth();
  const identity = {
    actorId: auth?.user.id,
    companyId: auth?.company?.id,
    token: auth?.accessToken,
  };
  const summary = useAdvertisingSummaryV11(identity, { from, to, storeId, seriesBy: "account" });
  const business = useAdvertisingBusinessMetrics(identity, {
    from,
    to,
    storeId,
    channelId: "all",
    basis: "delivered",
    timeZone: "America/Lima",
  });
  if (!identity.actorId || !identity.companyId || !identity.token) return null;
  if (summary.isError || business.isError)
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{advertisingErrorMessage(summary.error ?? business.error)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void summary.refetch();
              void business.refetch();
            }}
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!summary.data || !business.data)
    return <Skeleton className="h-52" aria-label="Cargando reporte de publicidad y entregas" />;
  return (
    <section className="space-y-4" aria-label="Reporte de publicidad y entregas">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.data.currencies.map((total) => (
            <div key={total.currency} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {total.currency} ·{" "}
                {total.coverage === "complete" ? "conciliado" : "datos pendientes"}
              </span>
              <strong className="font-mono text-xl tabular-nums">
                {formatMetaSpend(total.spend, total.currency)}
              </strong>
            </div>
          ))}
          {!summary.data.currencies.length ? (
            <p className="text-sm text-muted-foreground">Sin gasto disponible.</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Consumo efectivo de todas las cuentas; conserva ajustes manuales revisados.
          </p>
        </CardContent>
      </Card>
      <AdvertisingWholeBusinessCard
        summary={summary.data}
        business={business.data}
        storeName={storeName}
      />
    </section>
  );
}
