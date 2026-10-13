import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import {
  compareAdvertisingBusinessCurrency,
  formatAdvertisingMetric,
} from "./advertising-business-metrics-model";
import { formatMetaSpend } from "./advertising-meta-model";

export function AdvertisingWholeBusinessCard({
  business,
  summary,
  storeName,
}: {
  business: AdvertisingBusinessMetrics;
  summary: AdvertisingSummaryV11;
  storeName?: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">
          Negocio completo{storeName ? ` · ${storeName}` : ""}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ventas con y sin anuncio. Incluye todas las plataformas y cuentas.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {business.currencies.map((orders) => {
          const spend = summary.currencies.find((total) => total.currency === orders.currency);
          const result = spend
            ? compareAdvertisingBusinessCurrency(summary, spend, business)
            : { costPerDelivered: null, revenueToSpend: null, reason: "Gasto pendiente" };
          return (
            <section
              key={orders.currency ?? "unknown"}
              className="space-y-3"
              aria-label={`Negocio en ${orders.currency ?? "moneda sin confirmar"}`}
            >
              <Badge variant="outline">{orders.currency ?? "Moneda sin confirmar"}</Badge>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <BusinessMetric
                  title="Entregados"
                  value={new Intl.NumberFormat("es-PE").format(orders.deliveredCount)}
                />
                <BusinessMetric
                  title="Venta entregada"
                  value={
                    orders.currency
                      ? formatMetaSpend(orders.deliveredRevenue, orders.currency)
                      : "Pendiente"
                  }
                />
                <BusinessMetric
                  title="Publicidad por entregado"
                  value={
                    orders.currency && result.costPerDelivered
                      ? formatMetaSpend(result.costPerDelivered, orders.currency)
                      : "Pendiente"
                  }
                />
                <BusinessMetric
                  title="Venta ÷ publicidad"
                  value={
                    result.revenueToSpend
                      ? formatAdvertisingMetric(result.revenueToSpend, "×")
                      : "Pendiente"
                  }
                />
              </dl>
              {business.countCoverage &&
              summary.currencies.length === 1 &&
              orders.currency === summary.currencies[0].currency &&
              orders.deliveredCount !== business.deliveredCount ? (
                <p className="text-xs text-muted-foreground">
                  El costo por entrega usa los {business.deliveredCount} entregados del negocio.
                </p>
              ) : null}
              {result.reason ? (
                <p className="text-xs text-muted-foreground">
                  Comparación: {result.reason.toLowerCase()}.
                </p>
              ) : null}
              {"revenueReason" in result && result.revenueReason ? (
                <p className="text-xs text-muted-foreground">
                  Venta ÷ publicidad: {result.revenueReason.toLowerCase()}.
                </p>
              ) : null}
            </section>
          );
        })}
        {!business.currencies.length ? (
          <p className="text-sm text-muted-foreground">Sin entregados para este periodo.</p>
        ) : null}
        {business.quality.unknownCurrencyCount ? (
          <p className="text-xs text-muted-foreground">
            {business.quality.unknownCurrencyCount} pedidos tienen moneda por confirmar.
          </p>
        ) : null}
        {business.quality.missingDeliveredDateCount ? (
          <p className="text-xs text-muted-foreground">Hay entregados sin fecha confirmada.</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          La venta entregada usa el total del pedido con sus descuentos. No atribuye todas las
          ventas a la publicidad.
        </p>
      </CardContent>
    </Card>
  );
}
function BusinessMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{title}</dt>
      <dd className="break-words font-mono text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
