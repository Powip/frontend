"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import type { AdvertisingOrdersIdentity } from "@/hooks/useAdvertisingOrders";
import { advertisingErrorMessage } from "@/services/advertisingService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { formatMetaSpend } from "./advertising-meta-model";
import {
  advertisingStoreChannelTimeZone,
  compareAdvertisingStoreChannel,
} from "./advertising-store-channel-cost-model";

export function AdvertisingStoreChannelCost({
  identity,
  summary,
  channelId,
  channelName,
  storeName,
}: {
  identity: AdvertisingOrdersIdentity;
  summary: AdvertisingSummaryV11;
  channelId: string;
  channelName: string;
  storeName: string;
}) {
  const timeZone = advertisingStoreChannelTimeZone(summary, channelId);
  const filters = {
    from: summary.from,
    to: summary.to,
    storeId: summary.storeId,
    basis: "delivered" as const,
    timeZone: timeZone ?? "America/Lima",
  };
  const channel = useAdvertisingBusinessMetrics(
    { ...identity, enabled: !!timeZone },
    { ...filters, channelId },
  );
  const store = useAdvertisingBusinessMetrics(
    { ...identity, enabled: !!timeZone },
    { ...filters, channelId: "all" },
  );
  if (channel.isError || store.isError)
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{advertisingErrorMessage(channel.error ?? store.error)}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void channel.refetch();
              void store.refetch();
            }}
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  const currencies = [
    ...new Set([
      ...summary.currencies.map((row) => row.currency),
      ...(channel.data?.currencies ?? []).flatMap((row) => (row.currency ? [row.currency] : [])),
    ]),
  ];
  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      aria-label="Costo por entregado de tienda y canal"
    >
      <div>
        <h3 className="text-sm font-semibold">
          Costo por entregado · {storeName} · {channelName}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Gasto según los destinos y canales actuales; entregas con canal confirmado. Mismo periodo
          y moneda.
        </p>
      </div>
      {currencies.map((currency) => {
        const result = compareAdvertisingStoreChannel(
          summary,
          channelId,
          currency,
          channel.data,
          store.data,
        );
        return (
          <div key={currency} className="space-y-2">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Gasto · {currency}</dt>
                <dd className="font-mono font-semibold">
                  {formatMetaSpend(result.spend, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entregados</dt>
                <dd className="font-mono font-semibold">
                  {result.deliveredCount === null
                    ? "Pendiente"
                    : new Intl.NumberFormat("es-PE").format(result.deliveredCount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Costo por entregado</dt>
                <dd className="font-mono font-semibold">
                  {formatMetaSpend(result.costPerDelivered, currency)}
                </dd>
              </div>
            </dl>
            {result.reason ? (
              <p role="status" className="text-xs text-muted-foreground">
                {timeZone ? result.reason : "Zonas horarias por confirmar"}.
              </p>
            ) : null}
          </div>
        );
      })}
      {!currencies.length ? (
        <p className="text-sm text-muted-foreground">Gasto pendiente para este canal.</p>
      ) : null}
    </section>
  );
}
