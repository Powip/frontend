import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import { advertisingErrorMessage } from "@/services/advertisingService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import {
  compareAdvertisingBusinessCurrency,
  formatAdvertisingMetric,
} from "./advertising-business-metrics-model";
import { formatMetaSpend } from "./advertising-meta-model";

export function AdvertisingSummaryCards({
  summary,
  business,
  accountSelected = false,
  businessError,
}: {
  summary: AdvertisingSummaryV11;
  business?: AdvertisingBusinessMetrics;
  accountSelected?: boolean;
  businessError?: unknown;
}) {
  return (
    <div className="space-y-5" aria-live="polite">
      {summary.currencies.map((total) => {
        const comparison = compareAdvertisingBusinessCurrency(
          summary,
          total,
          business,
          accountSelected,
        );
        return (
          <section
            key={total.currency}
            className="space-y-2"
            aria-label={`Indicadores en ${total.currency}`}
          >
            <p className="text-xs font-medium text-muted-foreground">{total.currency}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric title="Gasto" value={formatMetaSpend(total.spend, total.currency)}>
                <Badge variant="outline">
                  {total.coverage === "complete"
                    ? "Completo"
                    : total.coverage === "partial"
                      ? "Parcial"
                      : "Pendiente"}
                </Badge>
              </Metric>
              <Card>
                <CardContent className="space-y-3 pt-5">
                  <h3 className="text-sm font-medium">Costo por resultado · Meta</h3>
                  {total.costPerResult.length ? (
                    <dl className="space-y-2">
                      {total.costPerResult.map((result) => (
                        <div
                          key={`${result.type}:${result.resultType ?? result.label}`}
                          className="space-y-0.5"
                        >
                          <dt className="text-xs text-muted-foreground">{result.label}</dt>
                          <dd className="font-mono text-lg font-semibold tabular-nums">
                            {result.status === "complete"
                              ? formatMetaSpend(result.costPerResult, total.currency)
                              : "Pendiente"}
                          </dd>
                          {result.limitation === "optimization-event-unconfirmed" ? (
                            <p className="text-xs text-muted-foreground">
                              Evento optimizado por confirmar.
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-2xl font-semibold">Pendiente</p>
                  )}
                  <p className="text-xs text-muted-foreground">Resultados reportados por Meta.</p>
                </CardContent>
              </Card>
              <Metric title="CTR de enlace · Meta" value={formatAdvertisingMetric(total.ctr, " %")}>
                <p className="text-xs text-muted-foreground">Clics en el enlace ÷ impresiones.</p>
              </Metric>
              <Metric
                title="Frecuencia · Meta"
                value={formatAdvertisingMetric(
                  total.periodMetricsStatus === "available" ? total.frequency : null,
                )}
              >
                <p className="text-xs text-muted-foreground">
                  {total.frequencyApproximate
                    ? "Aproximada entre cuentas."
                    : "Veces por persona en el periodo."}
                </p>
                {total.periodMetricsStatus === "available" &&
                total.frequencyHigh &&
                total.frequency !== null ? (
                  <Badge variant="outline">Alta · más de 3</Badge>
                ) : null}
              </Metric>
              <Metric
                title="Costo por entregado"
                value={
                  comparison.costPerDelivered
                    ? formatMetaSpend(comparison.costPerDelivered, total.currency)
                    : "Pendiente"
                }
              >
                <p className="text-xs text-muted-foreground">
                  {businessError
                    ? advertisingErrorMessage(businessError)
                    : (comparison.reason ?? "Gasto ÷ entregados de Powip.")}
                </p>
              </Metric>
            </div>
          </section>
        );
      })}
    </div>
  );
}
function Metric({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="break-words font-mono text-2xl font-semibold tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}
