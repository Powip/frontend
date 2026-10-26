"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { adsGet, type AdsProduct } from "@/services/advertisingV22Service";
import {
  getNumbersV23,
  type AdsSalesV23,
  type AdsSummaryV23,
  type SalesRowV23,
} from "@/services/advertisingV23Service";
import { useAdvertisingAccountFilter } from "../AdvertisingAccountFilterContext";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { advertisingSectionHref } from "../advertising-sections";
import { useAdsQuery, useAdsV22 } from "./context";
import {
  comparisonPeriod,
  dateRange,
  decimal,
  money,
  pct,
  profitUsage,
  ratio,
  trafficLight,
} from "./model";
import { Block, dataWarning, exportAdsWorkbook, Failure, MetricCard } from "./shared";
import {
  breakdownV23,
  codLeads,
  scopeDays,
  totalV23,
  v23Financial,
  v23Scope,
  type V23Financial,
  type V23Breakdown,
} from "./v23-model";
import { MonthlyNumbersV23 } from "./MonthlyV23";
import { ProductsV23 } from "./ProductsV23";
import { DailyPace } from "./Numbers";

export function useNumbersV23(from: string, to: string, enabled = true) {
  return useAdsQuery(
    ["numbers-v23", from, to],
    (identity, signal) => getNumbersV23(identity, from, to, signal),
    enabled && from <= to,
  );
}
const labelDate = (date: string) => format(parseISO(date), "d 'de' MMMM", { locale: es });
const valueCell = "whitespace-nowrap px-3 py-3 text-right tabular-nums";
const thCell = "whitespace-nowrap px-3 py-3 text-right text-xs font-medium text-muted-foreground";
const delta = (current: number | null, previous: number | null) =>
  previous === null || current === null || previous === 0 ? null : (current - previous) / previous;
export const financialExportV23 = (m: V23Financial, canSpend: boolean, canProfit: boolean) => ({
  ...(canSpend ? { Gasto: m.spend } : {}),
  "Pedidos ingresados": m.orders,
  "Ajustes de pedidos": m.adjustmentOrders,
  "Pedidos netos": m.ordersNet,
  "Productos ingresados": m.units,
  "Facturación ingresada": m.enteredRevenue,
  ...(canSpend ? { CPV: m.cpv, CPP: m.cpp, "ROAS ingresado": m.roasEntered } : {}),
  Confirmadas: m.confirmed,
  Entregadas: m.delivered,
  "En camino": m.inTransit,
  "Facturación entregada": m.deliveredRevenueValue,
  ...(canSpend
    ? {
        "Costo por venta entregada": m.costDelivered,
        "Costo por venta entregada proyectado": m.projectedCost,
        "ROAS entregado": m.roasDelivered,
      }
    : {}),
  ...(canProfit
    ? { "Lo máximo por venta": m.maximum, Ganancia: m.gain, "Ganancia proyectada": m.projectedGain }
    : {}),
  Atribución: m.estimated ? "Estimado por resultados de Meta" : "CRM / sin asignar",
});
export async function shareAdvertisingV23(text: string) {
  // The user chooses the chat and sends in WhatsApp. No recipient or background send is inferred.
  const opened = window.open("about:blank", "_blank");
  if (opened) opened.opener = null;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* Text is also prefilled if clipboard permission is unavailable. */
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (opened) opened.location.href = url;
  else window.location.assign(url);
}
function Cost({ value, reason }: { value: number | null; reason?: string }) {
  return (
    <span
      title={
        value === null
          ? (reason ?? "Falta gasto completo, costo histórico o un denominador mayor que cero.")
          : undefined
      }
    >
      {money(value)}
    </span>
  );
}
function Ratio({ value }: { value: number | null }) {
  return (
    <span title={value === null ? "Sin denominador válido o datos completos" : undefined}>
      {decimal(value, value === null ? "" : "x")}
    </span>
  );
}
export function AdvertisingNumbersV23() {
  const { fromDate, toDate } = useAdminPeriod(),
    { storeId, stores } = useAdvertisingStoreFilter(),
    { accountId } = useAdvertisingAccountFilter(),
    { settings } = useAdsV22();
  const comparison = comparisonPeriod(fromDate, toDate),
    query = useNumbersV23(fromDate, comparison.effectiveTo),
    previous = useNumbersV23(comparison.from, comparison.to);
  const products = useAdsQuery(["products-v22", "all"], (identity, signal) =>
    adsGet<{ products: AdsProduct[] }>(identity, "/v22/products", { storeId: "all" }, signal),
  );
  const [exportError, setExportError] = useState<unknown>(null),
    [byChannel, setByChannel] = useState(false);
  const canSpend = settings?.capabilities.spend === true,
    canProfit = settings?.capabilities.profit === true;
  if (fromDate > comparison.effectiveTo)
    return <p className="p-6 text-sm">El período elegido todavía no tiene días transcurridos.</p>;
  if (query.isError)
    return (
      <div className="p-6">
        <Failure error={query.error} retry={query.refetch} />
      </div>
    );
  if (!query.data) return <Skeleton className="m-6 h-80" aria-label="Cargando Publicidad v2.3" />;
  const { summary, sales } = query.data,
    rows = v23Scope(sales.daily, summary, storeId, accountId),
    metric = v23Financial(rows, summary, sales, storeId, accountId);
  const old = previous.data
    ? v23Financial(
        v23Scope(previous.data.sales.daily, previous.data.summary, storeId, accountId),
        previous.data.summary,
        previous.data.sales,
        storeId,
        accountId,
      )
    : null;
  const single = fromDate === comparison.effectiveTo,
    cod =
      !!sales.shopifyCod?.enabled &&
      sales.shopifyCod.storeIds.some((id) => storeId === "all" || id === storeId);
  const title =
    storeId === "all"
      ? stores.map((s) => s.name).join(" + ")
      : (stores.find((s) => s.id === storeId)?.name ?? "Negocio");
  const channelGroups = breakdownV23("channel", summary, sales, storeId, accountId),
    sellerGroups = breakdownV23("seller", summary, sales, storeId, accountId);
  const exportSheets = async () => {
    try {
      setExportError(null);
      await exportAdsWorkbook(
        `POWIP_Publicidad_${single ? "Dia" : "Periodo"}_${fromDate}_${comparison.effectiveTo}`,
        [
          {
            name: single ? "Reporte del día" : "Período",
            rows: [{ Negocio: title, ...financialExportV23(metric, canSpend, canProfit) }],
          },
          ...(
            [
              ["Por vendedora", sellerGroups],
              ["Por canal", channelGroups],
            ] as const
          ).map(([name, groups]) => ({
            name,
            rows: groups.map((g) => ({
              Nombre: g.name,
              ...financialExportV23(
                v23Financial(g.rows, summary, sales, storeId, accountId, "all", g.days),
                canSpend,
                canProfit,
              ),
            })),
          })),
          {
            name: "Ajustes",
            rows: sales.adjustments
              .filter(
                (a) =>
                  (storeId === "all" || a.storeId === storeId) &&
                  (accountId === "all" || a.accountId === accountId || !a.accountId),
              )
              .map((a) => ({
                Fecha: a.date,
                Pedido: a.orderNumber,
                Motivo: a.reason,
                "Variación pedidos": a.orderDelta,
                "Importe neto sin envío": a.amount,
              })),
          },
        ],
      );
    } catch (error) {
      setExportError(error);
    }
  };
  const shareDay = () =>
    shareAdvertisingV23(
      [
        `📊 Informe ${labelDate(fromDate)} — ${title}`,
        canSpend
          ? `Gasto ${money(metric.spend)} · CPV ${money(metric.cpv)} · CPP ${money(metric.cpp)}`
          : "",
        `Pedidos ${decimal(metric.ordersNet)} · Productos ${decimal(metric.units)} · Facturación ingresada ${money(metric.enteredRevenue)}`,
        canSpend ? `ROAS ingresado ${decimal(metric.roasEntered, "x")}` : "",
        ...(
          [
            ["Por vendedora", sellerGroups],
            ["Por canal", channelGroups],
          ] as const
        ).flatMap(([name, groups]) => [
          name,
          ...groups.map((g) => {
            const m = v23Financial(g.rows, summary, sales, storeId, accountId, "all", g.days);
            return `${g.name}: ${canSpend ? `gasto ${money(m.spend)} · ` : ""}${decimal(m.ordersNet)} pedidos · ${decimal(m.units)} productos${canSpend ? ` · CPV ${money(m.cpv)} · CPP ${money(m.cpp)}` : ""}${g.leads ? ` · ${decimal(g.leads)} leads` : ""}`;
          }),
        ]),
        `Neto sin envío cobrado. Ajustes registrados: ${sales.adjustments.filter((a) => (storeId === "all" || a.storeId === storeId) && (accountId === "all" || a.accountId === accountId || !a.accountId)).length}.`,
        "◐ Las cuentas sin ID de venta se estiman por resultados de Meta dentro de tienda y canal; las confirmadoras registradas se conservan.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  const scopedWarnings =
    summary.quality.spendScopes?.find((s) => s.storeId === storeId)?.reasons ??
    summary.quality.warnings;
  const pendingRows = v23Scope(sales.daily, summary, storeId, "all").filter(
    (row) => !row.accountId,
  );
  const pendingOrders = pendingRows.reduce((n, row) => n + row.orders, 0);
  const salesWarnings: Record<string, string> = {
    ADJUSTMENT_EVENT_CAPTURE_NOT_INSTALLED:
      "Falta instalar el registro de ajustes. No se puede confirmar que este período no tenga devoluciones o descuentos.",
    HISTORICAL_ADJUSTMENTS_WITHOUT_DATED_AMOUNT_NOT_RECONSTRUCTED:
      "Los ajustes anteriores sin fecha e importe comprobables no se reconstruyen en este reporte.",
    CONFIRMING_SELLER_MISSING_NO_EDITOR_FALLBACK:
      "Hay ventas sin confirmadora registrada. Se muestran sin asignar o estimadas; editar un pedido no cambia su dueña.",
    COMMERCIAL_LEADS_SCHEMA_UNAVAILABLE: "La fuente de leads COD no está disponible.",
    RETURNED_DELIVERY_ACTIVITY_WITHOUT_HISTORICAL_AMOUNT_SNAPSHOT:
      "Hay entregas posteriormente devueltas sin una foto histórica verificable. Revisa el detalle de ajustes.",
  };
  const warnings = [
    ...scopedWarnings.map(dataWarning),
    ...(sales.warnings ?? []).map((w) => salesWarnings[w] ?? `Ventas: ${w}`),
  ];
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${single ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "bg-muted/30"}`}
      >
        <div>
          <h2 className="font-semibold">
            {single ? `Reporte del día · ${labelDate(fromDate)}` : "Mis números · Publicidad v2.3"}
          </h2>
          <p className="text-xs opacity-80">
            {title} ·{" "}
            {single && fromDate === summary.today
              ? `Hoy, hasta ${new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "numeric", minute: "2-digit" }).format(new Date())}`
              : `${labelDate(fromDate)} – ${labelDate(comparison.effectiveTo)}`}{" "}
            · importes netos sin envío cobrado
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void exportSheets()}>
            Excel
          </Button>
          {single && (
            <Button size="sm" variant="outline" onClick={() => void shareDay()}>
              Compartir por WhatsApp
            </Button>
          )}
          <a className="self-center text-sm underline" href="#mes-publicidad">
            Ver el mes
          </a>
        </div>
      </div>
      {exportError != null && <Failure error={exportError} />}
      {warnings.length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {[...new Set(warnings)].map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground" data-testid="attribution-v23">
        {metric.attributedOrders > 0
          ? `✓ Medido por anuncio · ${pct(ratio(metric.attributedOrders, metric.orders))} de pedidos. `
          : ""}
        ◐ Cuentas estimadas por resultados de Meta cuando falta el ID de venta.{" "}
        {decimal(pendingOrders)} pedidos del negocio siguen sin atribución por falta de resultados
        comparables. La venta pertenece a quien la confirma.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {canSpend && (
          <MetricCard
            label="Gasto en publicidad"
            value={<Cost value={metric.spend} />}
            variation={delta(metric.spend, old?.spend ?? null)}
            detail={`${
              new Set(
                scopeDays(summary, storeId, accountId)
                  .filter((d) => Number(d.spend) > 0)
                  .map((d) => d.adId),
              ).size
            } anuncios con gasto`}
          />
        )}
        <MetricCard
          label="Pedidos ingresados"
          value={decimal(metric.ordersNet)}
          variation={delta(metric.ordersNet, old?.ordersNet ?? null)}
          detail={
            <>
              {canSpend && (
                <>
                  CPV <Cost value={metric.cpv} /> ·{" "}
                </>
              )}
              {decimal(metric.orders)} ingresados
              {metric.adjustmentOrders !== 0
                ? ` · ajustes ${decimal(metric.adjustmentOrders)}`
                : ""}
              {cod && <p>Incluye {decimal(metric.convertedCodOrders)} leads convertidos</p>}
            </>
          }
        />
        <MetricCard
          label="Productos ingresados"
          value={decimal(metric.units)}
          variation={delta(metric.units, old?.units ?? null)}
          detail={
            <>
              {canSpend && (
                <>
                  CPP <Cost value={metric.cpp} /> ·{" "}
                </>
              )}
              {decimal(ratio(metric.units, metric.orders))} por pedido
            </>
          }
        />
        <MetricCard
          label="Facturación ingresada"
          value={money(metric.enteredRevenue)}
          variation={delta(metric.enteredRevenue, old?.enteredRevenue ?? null)}
          detail={
            canSpend ? (
              <>
                ROAS ingresado <Ratio value={metric.roasEntered} />
              </>
            ) : (
              "Pedidos + ajustes registrados en el período"
            )
          }
        />
        <MetricCard
          label="Ventas entregadas"
          value={decimal(metric.delivered)}
          variation={delta(metric.delivered, old?.delivered ?? null)}
          detail={
            <>
              {decimal(metric.inTransit)} en camino
              {canSpend && (
                <p>
                  Real <Cost value={metric.costDelivered} /> ·{" "}
                  <em>
                    Proy. <Cost value={metric.projectedCost} />
                  </em>
                </p>
              )}
            </>
          }
        />
        <MetricCard
          label="Facturación entregada"
          value={money(metric.deliveredRevenueValue)}
          variation={delta(metric.deliveredRevenueValue, old?.deliveredRevenueValue ?? null)}
          detail={
            canSpend ? (
              <>
                ROAS entregado <Ratio value={metric.roasDelivered} />
              </>
            ) : (
              "Cohorte de pedidos ingresados"
            )
          }
        />
      </div>
      {cod && (
        <CodSection
          summary={summary}
          sales={sales}
          storeId={storeId}
          accountId={accountId}
          canSpend={canSpend}
        />
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <Block title="Ticket promedio">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>Por venta entregada</dt>
            <dd className="text-right font-semibold">{money(metric.ticket)}</dd>
            <dt>Por unidad entregada</dt>
            <dd className="text-right font-semibold">{money(metric.ticketUnit)}</dd>
            <dt>Unidades entregadas</dt>
            <dd className="text-right">{decimal(metric.deliveredUnits)}</dd>
            <dt>Unidades por entrega</dt>
            <dd className="text-right">
              {decimal(ratio(metric.deliveredUnits, metric.delivered))}
            </dd>
            <dt>Valor neto ingresado</dt>
            <dd className="text-right">{money(metric.enteredRevenue)}</dd>
          </dl>
        </Block>
        <Block title="Tasas de conversión">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt title="Confirmadas normales ÷ pedidos normales. Excluye conversiones COD de ambos lados.">
              Confirmación de pedidos
            </dt>
            <dd className="text-right font-semibold">{pct(metric.confirmationRate)}</dd>
            <dt>Entrega de confirmadas</dt>
            <dd className="text-right font-semibold">{pct(metric.deliveryRate)}</dd>
            <dt>Entregadas de cada 100 pedidos</dt>
            <dd className="text-right">{pct(ratio(metric.delivered, metric.orders))}</dd>
            <dt>Rechazados o anulados</dt>
            <dd
              className={`text-right ${metric.rejectedRate !== null && metric.rejectedRate > 0.15 ? "text-red-600" : ""}`}
            >
              {pct(metric.rejectedRate)}
            </dd>
            {canSpend && (
              <>
                <dt>Costo por confirmada</dt>
                <dd className="text-right">
                  <Cost value={metric.costConfirmed} />
                </dd>
              </>
            )}
          </dl>
          <p className="text-xs text-muted-foreground">
            Confirmación excluye los leads COD que entraron ya confirmados. Las tasas siguen la
            cohorte del período.
          </p>
        </Block>
        {canProfit && (
          <ProfitCard
            metric={metric}
            nearLimit={summary.settings.rules.nearLimitPct}
            canSpend={canSpend}
          />
        )}
      </div>
      <BreakdownTable
        title="1. Por vendedora"
        groups={sellerGroups}
        summary={summary}
        sales={sales}
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
        canProfit={canProfit}
      />
      <p className="text-xs text-muted-foreground">
        La venta conserva a su confirmadora. El gasto viene de los conjuntos asignados; COD se
        reparte según leads recibidos por cada vendedora. Los pedidos sin confirmadora solo se
        estiman si hay resultados en conjuntos asignados.
      </p>
      <BreakdownTable
        title="2. Por canal"
        groups={channelGroups}
        summary={summary}
        sales={sales}
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
        canProfit={canProfit}
        showLeads={cod}
      />
      {single && (
        <ActivitySection
          summary={summary}
          sales={sales}
          storeId={storeId}
          accountId={accountId}
          canSpend={canSpend}
        />
      )}
      <AdjustmentsSection sales={sales} storeId={storeId} accountId={accountId} />
      {canSpend && <DailyPace />}
      <MonthlyNumbersV23
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
        canProfit={canProfit}
      />
      <AccountTable
        summary={summary}
        sales={sales}
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
        canProfit={canProfit}
      />
      <ComparisonTable
        summary={summary}
        sales={sales}
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
        canProfit={canProfit}
        byChannel={byChannel}
        toggle={() => setByChannel(!byChannel)}
      />
      {products.isError ? (
        <Failure error={products.error} retry={products.refetch} />
      ) : products.data ? (
        <ProductsV23
          summary={summary}
          sales={sales}
          products={products.data.products}
          storeId={storeId}
          accountId={accountId}
          canSpend={canSpend}
          canProfit={canProfit}
        />
      ) : (
        <Skeleton className="h-40" aria-label="Cargando costo por producto" />
      )}
      <Block title="Embudo del período">
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            ["Pedidos ingresados", metric.ordersNet, metric.cpv],
            ["Confirmadas", metric.confirmed, metric.costConfirmed],
            ["Entregadas", metric.delivered, metric.costDelivered],
            ["En camino", metric.inTransit, null],
            [
              "Rechazadas / anuladas",
              Math.max(0, metric.confirmed - metric.delivered - metric.inTransit),
              null,
            ],
          ].map(([name, count, cost]) => (
            <div key={String(name)} className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs">{name}</p>
              <p className="text-xl font-semibold">{decimal(count as number)}</p>
              {canSpend && cost !== null && <p className="text-xs">{money(cost as number)}</p>}
            </div>
          ))}
        </div>
      </Block>
      {dateRange(fromDate, comparison.effectiveTo).length > 31 && (
        <Block title="Gasto en el período">
          <PeriodChart
            rows={rows}
            summary={summary}
            sales={sales}
            storeId={storeId}
            accountId={accountId}
            canSpend={canSpend}
          />
        </Block>
      )}
    </div>
  );
}
function ProfitCard({
  metric: m,
  nearLimit,
  canSpend,
}: {
  metric: V23Financial;
  nearLimit: number;
  canSpend: boolean;
}) {
  const usage = profitUsage(m.inTransit ? m.projectedCost : m.costDelivered, m.maximum),
    light = trafficLight(usage, nearLimit);
  return (
    <Block title="¿Es rentable?">
      <p className={`font-semibold ${light.className}`}>
        {usage === null ? "Faltan datos para evaluar" : light.label}
      </p>
      {canSpend && (
        <>
          <p className="text-sm">
            Costo por venta entregada {money(m.costDelivered)} ·{" "}
            <em>proyectado {money(m.projectedCost)}</em>
          </p>
          <div
            className="relative h-2 overflow-hidden rounded bg-muted"
            role="meter"
            aria-label="Publicidad sobre margen"
            aria-valuemin={0}
            aria-valuemax={150}
            aria-valuenow={usage === null ? undefined : Math.min(150, usage * 100)}
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${usage === null ? 0 : Math.min(100, (usage * 100) / 1.5)}%` }}
            />
            <span className="absolute left-2/3 top-0 h-full border-r-2 border-foreground" />
          </div>
        </>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Lo máximo por venta</dt>
        <dd className="text-right">{money(m.maximum)}</dd>
        <dt>Ganancia por unidad</dt>
        <dd className="text-right">{money(m.gainUnit)}</dd>
        <dt>Ganancia</dt>
        <dd className="text-right font-semibold">{money(m.gain)}</dd>
      </dl>
      {m.missingCostOrders > 0 && (
        <p className="text-xs text-amber-700">
          {decimal(m.missingCostOrders)} entregas sin costo histórico se excluyen del margen. El
          gasto completo sí se descuenta; la ganancia es parcial.
        </p>
      )}
    </Block>
  );
}
function CodSection({
  summary,
  sales,
  storeId,
  accountId,
  canSpend,
}: {
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
}) {
  const cod = sales.shopifyCod!,
    lead = codLeads(sales, summary, storeId, accountId),
    rows = v23Scope(cod.daily, summary, storeId, accountId, "all", sales.daily),
    days = scopeDays(summary, storeId, accountId).filter((d) => d.channelExact === "shopify_cod"),
    m = v23Financial(rows, summary, sales, storeId, accountId, "all", days);
  const ambiguous = scopeDays(summary, storeId, accountId).some(
      (d) => d.channel === "web" && d.channelExact == null,
    ),
    codSpend = ambiguous ? null : m.spend;
  return (
    <Block title="Shopify COD · Leads">
      <p className="text-xs text-muted-foreground">
        {summary.stores
          .filter((s) => cod.storeIds.includes(s.id) && (storeId === "all" || s.id === storeId))
          .map((s) => s.name)
          .join(" + ")}{" "}
        · un lead no es un pedido. Solo aparece con Shopify COD activo.
        {canSpend && ` Gasto de conjuntos COD: ${money(codSpend)}.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard
          label="Leads generados"
          value={decimal(lead.leads)}
          detail={canSpend ? `Costo por lead ${money(ratio(codSpend, lead.leads))}` : undefined}
        />
        <MetricCard
          label="Convertidos a venta · cohorte de leads"
          value={decimal(lead.converted)}
          detail={`${pct(ratio(lead.converted, lead.leads))} de leads recibidos`}
        />
        <MetricCard
          label="Pedidos COD ingresados"
          value={decimal(m.orders)}
          detail={
            canSpend
              ? `CPV ${money(ratio(codSpend, m.orders))} · entregadas ${decimal(m.delivered)}`
              : `Entregadas ${decimal(m.delivered)}`
          }
        />
        <MetricCard
          label="Facturación entregada COD"
          value={money(m.deliveredRevenueValue)}
          detail={
            canSpend
              ? `Costo por venta entregada ${money(ratio(codSpend, m.delivered))} · ROAS ${decimal(ratio(m.deliveredRevenueValue, codSpend), "x")}`
              : undefined
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Leads: fecha de recepción. Pedidos: fecha de conversión, incluidos una vez en el total
        general. Los leads recibidos antes del período pueden convertirse ahora.
      </p>
      {ambiguous && (
        <p className="text-xs text-amber-700">
          Asigna los conjuntos web a Shopify COD para calcular su gasto y costos sin mezclarlo con
          Web.
        </p>
      )}
    </Block>
  );
}
function BreakdownTable({
  title,
  groups,
  summary,
  sales,
  storeId,
  accountId,
  canSpend,
  canProfit,
  showLeads = false,
}: {
  title: string;
  groups: V23Breakdown[];
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
  canProfit: boolean;
  showLeads?: boolean;
}) {
  const [error, setError] = useState<unknown>(null),
    items = groups.map((g) => ({
      ...g,
      metric: v23Financial(g.rows, summary, sales, storeId, accountId, "all", g.days),
    })),
    total = v23Financial(
      groups.flatMap((g) => g.rows),
      summary,
      sales,
      storeId,
      accountId,
      "all",
      groups.flatMap((g) => g.days),
    );
  const exportRows = items.map((g) => ({
    Nombre: g.name,
    ...(showLeads ? { Leads: g.leads } : {}),
    ...financialExportV23(g.metric, canSpend, canProfit),
  }));
  return (
    <Block
      title={title}
      tools={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void exportAdsWorkbook(
              `POWIP_Publicidad_${title.replace(/\W/g, "_")}_${summary.from}_${summary.to}`,
              [
                {
                  name: title,
                  rows: [
                    ...exportRows,
                    { Nombre: "TOTAL", ...financialExportV23(total, canSpend, canProfit) },
                  ],
                },
              ],
            ).catch(setError)
          }
        >
          Excel
        </Button>
      }
    >
      {error != null && <Failure error={error} />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">
                {title.includes("canal")
                  ? "Canal"
                  : title.includes("cuenta")
                    ? "Cuenta publicitaria"
                    : "Vendedora"}
              </th>
              {canSpend && <th className={thCell}>Gasto</th>}
              {showLeads && (
                <>
                  <th className={thCell}>Leads</th>
                  {canSpend && <th className={thCell}>Costo por lead</th>}
                </>
              )}
              <th className={thCell}>Pedidos</th>
              <th className={thCell}>Productos</th>
              {title.includes("cuenta") && <th className={thCell}>Confirmadas</th>}
              <th className={thCell}>Facturación ingresada</th>
              {canSpend && (
                <>
                  <th className={thCell}>CPV</th>
                  <th className={thCell}>CPP</th>
                  <th className={thCell}>ROAS ingresado</th>
                </>
              )}
              <th className={thCell}>Entregadas</th>
              <th className={thCell}>Facturación entregada</th>
              {canSpend && (
                <>
                  <th className={thCell}>Costo por venta entregada</th>
                  <th className={thCell}>ROAS entregado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {[
              ...items,
              {
                id: "total",
                name: "TOTAL",
                metric: total,
                leads: groups.reduce((n, g) => n + g.leads, 0),
                estimated: false,
              },
            ].map((g) => (
              <tr
                key={g.id}
                className={`border-t ${g.id === "total" ? "bg-muted/40 font-semibold" : ""}`}
              >
                <th className="whitespace-nowrap p-3 text-left font-medium">
                  {g.name}
                  {g.estimated && (
                    <span className="block text-xs text-muted-foreground">◐ Pedidos estimados</span>
                  )}
                </th>
                {canSpend && (
                  <td className={valueCell}>
                    <Cost value={g.metric.spend} />
                  </td>
                )}
                {showLeads && (
                  <>
                    <td className={valueCell}>{decimal(g.leads)}</td>
                    {canSpend && (
                      <td className={valueCell}>
                        <Cost value={ratio(g.metric.spend, g.leads)} />
                      </td>
                    )}
                  </>
                )}
                <td className={valueCell}>{decimal(g.metric.ordersNet)}</td>
                <td className={valueCell}>{decimal(g.metric.units)}</td>
                {title.includes("cuenta") && (
                  <td className={valueCell}>{decimal(g.metric.confirmed)}</td>
                )}
                <td className={valueCell}>{money(g.metric.enteredRevenue)}</td>
                {canSpend && (
                  <>
                    <td className={valueCell}>
                      <Cost value={g.metric.cpv} />
                    </td>
                    <td className={valueCell}>
                      <Cost value={g.metric.cpp} />
                    </td>
                    <td className={valueCell}>
                      <Ratio value={g.metric.roasEntered} />
                    </td>
                  </>
                )}
                <td className={valueCell}>{decimal(g.metric.delivered)}</td>
                <td className={valueCell}>{money(g.metric.deliveredRevenueValue)}</td>
                {canSpend && (
                  <>
                    <td className={valueCell}>
                      <Cost value={g.metric.costDelivered} />
                    </td>
                    <td className={valueCell}>
                      <Ratio value={g.metric.roasDelivered} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        El gasto se conserva completo, incluidas las filas sin asignar. CPV = gasto ÷ pedidos netos
        ingresados; CPP = gasto ÷ productos ingresados.
      </p>
    </Block>
  );
}
function ActivitySection({
  summary,
  sales,
  storeId,
  accountId,
  canSpend,
}: {
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
}) {
  const m = v23Financial(
    v23Scope(sales.deliveredActivity.daily, summary, storeId, accountId, "all", sales.daily),
    summary,
    sales,
    storeId,
    accountId,
  );
  const missingDates = (sales.deliveredActivity.missingDatesByStore ?? [])
    .filter((row) => storeId === "all" || row.storeId === storeId)
    .reduce((sum, row) => sum + row.orders, 0);
  return (
    <Block title="Entregado hoy · actividad de la fecha elegida">
      {missingDates > 0 && (
        <p role="status" className="text-sm text-amber-700">
          Hay {decimal(missingDates)} entregas del historial disponible sin fecha comprobable en
          este negocio. Se identificaron {decimal(m.delivered)} entregas fechadas ese día; el total
          y sus costos quedan pendientes para no atribuir entregas a una fecha inventada.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard
          label="Pedidos entregados ese día"
          value={decimal(missingDates ? null : m.delivered)}
        />
        <MetricCard
          label="Facturación entregada ese día"
          value={money(missingDates ? null : m.deliveredRevenueValue)}
        />
        {canSpend && (
          <>
            <MetricCard
              label="Costo por venta entregada · actividad"
              value={money(missingDates ? null : m.costDelivered)}
            />
            <MetricCard
              label="ROAS entregado · actividad"
              value={<Ratio value={missingDates ? null : m.roasDelivered} />}
            />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Usa la fecha real de entrega, aunque el pedido entrara antes. Este costo compara el gasto
        del día con sus entregas; no se mezcla con las tasas de la cohorte.
      </p>
    </Block>
  );
}
function AdjustmentsSection({
  sales,
  storeId,
  accountId,
}: {
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
}) {
  const changes = sales.adjustments.filter(
    (a) =>
      (storeId === "all" || a.storeId === storeId) &&
      (accountId === "all" || a.accountId === accountId || !a.accountId),
  );
  return (
    <Block title="Ajustes registrados en el período">
      <p className="text-xs text-muted-foreground">
        Se descuentan en la fecha de registro y conservan el pedido y el motivo. Los ajustes
        históricos sin importe y fecha comprobables no se reconstruyen.
      </p>
      {!changes.length ? (
        <p className="text-sm text-muted-foreground">Sin ajustes registrados en este período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Fecha", "Pedido", "Motivo", "Pedidos +/−", "Importe neto sin envío"].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {changes.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{a.date}</td>
                  <td className="p-3">{a.orderNumber}</td>
                  <td className="min-w-60 p-3">
                    {a.reason}
                    {accountId !== "all" && !a.accountId && (
                      <span className="block text-xs text-muted-foreground">
                        Sin cuenta verificada · detalle del negocio; importe del resumen estimado
                        por canal.
                      </span>
                    )}
                  </td>
                  <td className="p-3">{decimal(a.orderDelta)}</td>
                  <td className="p-3">
                    {a.amount === null
                      ? "— falta importe neto verificable"
                      : money(Number(a.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  );
}
function AccountTable(props: {
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
  canProfit: boolean;
}) {
  const { setAccountId } = useAdvertisingAccountFilter(),
    { summary, sales, storeId, accountId, canSpend, canProfit } = props,
    groups = breakdownV23("account", summary, sales, storeId, accountId);
  return (
    <div className="space-y-2">
      <BreakdownTable
        title="Por cuenta publicitaria"
        groups={groups}
        {...props}
        showLeads={!!sales.shopifyCod?.enabled}
      />
      <div className="flex flex-wrap gap-2">
        {(summary.accounts ?? []).map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={accountId === a.id ? "default" : "outline"}
            onClick={() => setAccountId(a.id)}
          >
            {a.name}
          </Button>
        ))}
        {accountId !== "all" && (
          <Button size="sm" variant="outline" onClick={() => setAccountId("all")}>
            Todas las cuentas
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        TikTok Ads · Google Ads — no conectados. Registra esa inversión en Administración › Otra
        inversión. Gasto de Meta sin tienda:{" "}
        {canSpend
          ? money(summary.unassignedSpend == null ? null : Number(summary.unassignedSpend))
          : "permiso de gasto requerido"}
        .
      </p>
    </div>
  );
}
function ComparisonTable({
  summary,
  sales,
  storeId,
  accountId,
  canSpend,
  canProfit,
  byChannel,
  toggle,
}: {
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
  canProfit: boolean;
  byChannel: boolean;
  toggle: () => void;
}) {
  const columns = [
    ...summary.stores.flatMap((store) => [
      { id: store.id, name: store.name, storeId: store.id, family: "all" },
      ...(byChannel
        ? [
            {
              id: `${store.id}-messages`,
              name: `${store.name} · 💬`,
              storeId: store.id,
              family: "messages",
            },
            { id: `${store.id}-web`, name: `${store.name} · 🌐`, storeId: store.id, family: "web" },
          ]
        : []),
    ]),
    { id: "all", name: "Total", storeId: "all", family: "all" },
  ].map((column) => ({
    ...column,
    m: v23Financial(
      v23Scope(sales.daily, summary, column.storeId, accountId, column.family),
      summary,
      sales,
      column.storeId,
      accountId,
      column.family,
    ),
  }));
  const definitions: Array<[string, (m: V23Financial) => string, boolean]> = [
    ["Gasto", (m) => money(m.spend), canSpend],
    ["Pedidos ingresados", (m) => decimal(m.ordersNet), true],
    ["Confirmadas", (m) => decimal(m.confirmed), true],
    ["Entregadas", (m) => decimal(m.delivered), true],
    ["Productos ingresados", (m) => decimal(m.units), true],
    ["Unidades entregadas", (m) => decimal(m.deliveredUnits), true],
    ["CPV", (m) => money(m.cpv), canSpend],
    ["CPP", (m) => money(m.cpp), canSpend],
    ["Costo por venta confirmada", (m) => money(m.costConfirmed), canSpend],
    ["Costo por venta entregada", (m) => money(m.costDelivered), canSpend],
    ["Costo por producto entregado", (m) => money(m.costDeliveredUnit), canSpend],
    ["Costo por venta entregada proyectado", (m) => money(m.projectedCost), canSpend],
    ["Lo máximo por venta", (m) => money(m.maximum), canProfit],
    [
      "Semáforo",
      (m) =>
        trafficLight(
          profitUsage(m.inTransit ? m.projectedCost : m.costDelivered, m.maximum),
          summary.settings.rules.nearLimitPct,
        ).label,
      canProfit && canSpend,
    ],
    ["ROAS ingresado", (m) => decimal(m.roasEntered, "x"), canSpend],
    ["ROAS entregado", (m) => decimal(m.roasDelivered, "x"), canSpend],
    ["Ticket por venta entregada", (m) => money(m.ticket), true],
    ["Ganancia por unidad", (m) => money(m.gainUnit), canProfit],
    ["Ganancia", (m) => money(m.gain), canProfit],
  ];
  const [error, setError] = useState<unknown>(null),
    exportRows = definitions
      .filter(([, , allowed]) => allowed)
      .map(([name, render]) =>
        Object.fromEntries([["Métrica", name], ...columns.map((c) => [c.name, render(c.m)])]),
      );
  return (
    <Block
      title="Cuánto me cuesta vender"
      tools={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={toggle}>
            {byChannel ? "Por tienda y canal" : "Por tienda"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void exportAdsWorkbook(`POWIP_Publicidad_Costos_${summary.from}_${summary.to}`, [
                { name: "Por tienda", rows: exportRows },
              ]).catch(setError)
            }
          >
            Excel
          </Button>
        </div>
      }
    >
      {error != null && <Failure error={error} />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">Métrica</th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className={`${thCell} ${c.storeId === storeId ? "bg-primary/10 text-primary" : ""}`}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {definitions
              .filter(([, , allowed]) => allowed)
              .map(([name, render]) => (
                <tr key={name} className="border-t">
                  <th className="whitespace-nowrap p-3 text-left font-normal">{name}</th>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={`${valueCell} ${c.storeId === storeId ? "bg-primary/5" : ""}`}
                    >
                      {render(c.m)}
                    </td>
                  ))}
                </tr>
              ))}
            <tr className="border-t">
              <th className="p-3 text-left font-normal">Otros canales sin publicidad · pedidos</th>
              {columns.map((c) => (
                <td key={c.id} className={valueCell}>
                  {decimal(
                    totalV23(v23Scope(sales.daily, summary, c.storeId, accountId, "other")).orders,
                  )}
                </td>
              ))}
            </tr>
            {canSpend && (
              <tr className="border-t">
                <th className="p-3 text-left font-normal">Gasto sin tienda</th>
                {columns.map((c) => (
                  <td key={c.id} className={valueCell}>
                    {c.storeId === "all"
                      ? money(
                          summary.unassignedSpend === null ? null : Number(summary.unassignedSpend),
                        )
                      : "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
function PeriodChart({
  rows,
  summary,
  sales,
  storeId,
  accountId,
  canSpend,
}: {
  rows: SalesRowV23[];
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  storeId: string;
  accountId: string;
  canSpend: boolean;
}) {
  const data = dateRange(summary.from, summary.to < summary.today ? summary.to : summary.today).map(
    (date) => {
      const m = v23Financial(
        rows.filter((r) => r.date === date),
        summary,
        sales,
        storeId,
        accountId,
        "all",
        scopeDays(summary, storeId, accountId).filter((d) => d.date === date),
      );
      return { date, spend: m.spend, orders: m.orders, revenue: m.deliveredRevenueValue };
    },
  );
  return (
    <div className="h-64" role="img" aria-label="Gasto, pedidos y facturación entregada por día">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
          <YAxis />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          {canSpend && <Bar name="Gasto (S/)" dataKey="spend" fill="#8b5cf6" />}
          <Line
            name="Facturación entregada (S/)"
            dataKey="revenue"
            stroke="#0f766e"
            yAxisId="right"
            dot={false}
          />
          <Line name="Pedidos" dataKey="orders" stroke="#c4b5fd" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
