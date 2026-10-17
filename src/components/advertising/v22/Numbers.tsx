"use client";
import { useMemo, useState } from "react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { fetchBusinessProducts } from "@/services/businessProductsService";
import {
  adsGet,
  getAdsSales,
  getAllAdsCatalog,
  type AdsSummary,
  type AdsSales,
  type AdsProduct,
} from "@/services/advertisingV22Service";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdsQuery, useAdsV22 } from "./context";
import {
  comparisonPeriod,
  dateRange,
  dayKey,
  decimal,
  limaToday,
  money,
  monthlyModel,
  numeric,
  paidRows,
  pct,
  ratio,
  profitUsage,
  spendRows,
  sumSales,
  sumSpend,
  summarize,
  productFinancialRows,
  summarySpendAvailable,
  trafficLight,
  type Financial,
} from "./model";
import { Block, Failure, MetricCard, SelectField, exportAdsWorkbook, dataWarning } from "./shared";

export function useNumbers(from: string, to: string, storeId: string, suffix = "period") {
  return useAdsQuery(
    ["numbers", suffix, from, to, storeId],
    async (identity, signal) => {
      const [summary, sales] = await Promise.all([
        adsGet<AdsSummary>(identity, "/v22/summary", { from, to, storeId }, signal),
        getAdsSales(identity, from, to, storeId, signal),
      ]);
      if (summary.from !== from || summary.to !== to || sales.from !== from || sales.to !== to)
        throw new Error("Los datos recibidos corresponden a otro período.");
      return { summary, sales };
    },
    from <= to,
  );
}
const dateLabel = (date: string) => format(parseISO(date), "d EEE", { locale: es });
const difference = (current: number | null, previous: number | null) =>
  current === null || previous === null || previous === 0 ? null : (current - previous) / previous;

export function AdvertisingNumbers() {
  const { fromDate, toDate } = useAdminPeriod();
  const { storeId, stores } = useAdvertisingStoreFilter();
  const { settings } = useAdsV22();
  const comparison = comparisonPeriod(fromDate, toDate);
  const query = useNumbers(fromDate, comparison.effectiveTo, "all");
  const previous = useNumbers(comparison.from, comparison.to, "all", "comparison");
  const products = useAdsQuery(["products-v22", "all"], (identity, signal) =>
    adsGet<{ products: AdsProduct[] }>(identity, "/v22/products", { storeId: "all" }, signal),
  );
  const [byChannel, setByChannel] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const permissions = settings!.capabilities;
  if (fromDate > comparison.effectiveTo)
    return <p className="p-6 text-sm">El período elegido todavía no tiene días transcurridos.</p>;
  if (query.isError)
    return (
      <div className="p-6">
        <Failure error={query.error} retry={query.refetch} />
      </div>
    );
  if (!query.data)
    return <Skeleton className="m-6 h-80" aria-label="Cargando números de publicidad" />;
  const { summary, sales } = query.data;
  const current = summarize(summary, sales, storeId);
  const prior = previous.data
    ? summarize(previous.data.summary, previous.data.sales, storeId)
    : null;
  const columns = [
    ...stores.flatMap((store) =>
      byChannel
        ? [
            {
              id: `${store.id}:messages`,
              storeId: store.id,
              name: `${store.name} · Mensajes`,
              channel: "messages",
            },
            {
              id: `${store.id}:web`,
              storeId: store.id,
              name: `${store.name} · Web`,
              channel: "web",
            },
          ]
        : [{ id: store.id, storeId: store.id, name: store.name, channel: "all" }],
    ),
    { id: "all", storeId: "all", name: "Total", channel: "all" },
  ];
  const metrics = columns.map((column) =>
    summarize(summary, sales, column.storeId, column.channel),
  );
  const definitions: Array<{
    label: string;
    key: Exclude<keyof Financial, "evidence">;
    type: "count" | "money" | "ratio";
    permission?: "spend" | "profit";
  }> = [
    { label: "Gasto en publicidad", key: "spend", type: "money", permission: "spend" },
    { label: "Pedidos", key: "orders", type: "count" },
    { label: "Confirmados", key: "confirmed", type: "count" },
    { label: "Entregados", key: "delivered", type: "count" },
    { label: "Unidades entregadas", key: "deliveredUnits", type: "count" },
    { label: "Costo por pedido", key: "costOrder", type: "money", permission: "spend" },
    { label: "Costo por confirmado", key: "costConfirmed", type: "money", permission: "spend" },
    { label: "Costo por venta", key: "costSale", type: "money", permission: "spend" },
    { label: "Costo por unidad", key: "costUnit", type: "money", permission: "spend" },
    {
      label: "Costo por venta proyectado",
      key: "projectedCost",
      type: "money",
      permission: "spend",
    },
    {
      label: "Lo máximo que puedes pagar por venta",
      key: "maximum",
      type: "money",
      permission: "profit",
    },
    { label: "ROAS", key: "roas", type: "ratio", permission: "spend" },
    { label: "Ticket promedio", key: "ticket", type: "money" },
    { label: "Ganancia por unidad", key: "gainUnit", type: "money", permission: "profit" },
    { label: "Ganancia", key: "gain", type: "money", permission: "profit" },
  ];
  const visibleDefinitions = definitions.filter(
    (row) => !row.permission || permissions[row.permission],
  );
  const productRows = productFinancialRows(summary, sales, products.data?.products ?? [], storeId);
  const exportComparison = async () => {
    try {
      await exportAdsWorkbook(`POWIP_Mis_numeros_${fromDate}_${comparison.effectiveTo}`, [
        {
          name: "Comparación",
          rows: visibleDefinitions.map((def) => ({
            Métrica: def.label,
            ...Object.fromEntries(
              columns.map((column, index) => [column.name, metrics[index][def.key]]),
            ),
          })),
        },
      ]);
    } catch (error) {
      setExportError(error);
    }
  };
  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Mis números</h2>
        <span className="rounded-full bg-primary/5 px-3 py-1 text-xs">
          {current.attributed > 0
            ? `✓ ${current.attributed < current.orders ? "Medido parcial" : "Medido por anuncio"} · ${pct(ratio(current.attributed, current.orders))} de pedidos`
            : "◐ Estimado por canal"}
        </span>
      </div>
      {summary.quality.warnings.map((warning) => (
        <p
          key={warning}
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {dataWarning(warning)}
        </p>
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {permissions.spend && (
          <MetricCard
            label="Gasto en publicidad"
            value={money(current.spend)}
            variation={difference(current.spend, prior?.spend ?? null)}
          />
        )}
        <MetricCard
          label="Pedidos"
          value={decimal(current.orders)}
          variation={difference(current.orders, prior?.orders ?? null)}
        />
        <MetricCard
          label="Unidades"
          value={decimal(current.units)}
          detail={`${current.deliveredUnits} entregadas`}
          variation={difference(current.units, prior?.units ?? null)}
        />
        <MetricCard
          label="Facturado (entregado)"
          value={money(current.revenue)}
          variation={difference(current.revenue, prior?.revenue ?? null)}
        />
      </div>
      {previous.isError && (
        <p className="text-xs text-muted-foreground">
          No pudimos obtener la comparación. Los valores del período actual siguen disponibles.
        </p>
      )}
      <MonthlyNumbers />
      <Block
        title="Cuánto me cuesta vender"
        tools={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setByChannel((value) => !value)}>
              {byChannel ? "Por tienda" : "Por tienda y canal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportComparison()}>
              ↓ Excel
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 min-w-52 bg-card p-3 text-left">Métrica</th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={`min-w-36 p-3 text-right ${column.storeId === storeId && storeId !== "all" ? "bg-primary/5 text-primary" : ""}`}
                  >
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDefinitions.map((def) => (
                <tr key={def.key} className="border-t">
                  <th className="sticky left-0 bg-card p-3 text-left font-normal">{def.label}</th>
                  {metrics.map((metric, index) => (
                    <td
                      key={columns[index].id}
                      className={`p-3 text-right tabular-nums ${columns[index].storeId === storeId && storeId !== "all" ? "bg-primary/5" : ""}`}
                    >
                      {def.type === "money"
                        ? money(metric[def.key])
                        : decimal(metric[def.key], def.type === "ratio" ? "×" : "")}
                    </td>
                  ))}
                </tr>
              ))}
              {permissions.profit && (
                <tr className="border-t">
                  <th className="sticky left-0 bg-card p-3 text-left font-normal">Semáforo</th>
                  {metrics.map((metric, index) => {
                    const status = trafficLight(
                      profitUsage(metric.costSale, metric.maximum),
                      settings!.rules.nearLimitPct,
                    );
                    return (
                      <td key={columns[index].id} className={`p-3 text-right ${status.className}`}>
                        {status.label}
                      </td>
                    );
                  })}
                </tr>
              )}
              <tr className="border-t text-muted-foreground">
                <th className="sticky left-0 bg-card p-3 text-left font-normal">
                  Otros canales sin publicidad · pedidos
                </th>
                {columns.map((column) => (
                  <td key={column.id} className="p-3 text-right">
                    {
                      sumSales(
                        sales.byChannel.filter(
                          (row) =>
                            row.channel === "other" &&
                            (column.storeId === "all" || row.storeId === column.storeId),
                        ),
                      ).orders
                    }
                  </td>
                ))}
              </tr>
              {permissions.spend && (
                <tr className="border-t bg-amber-50 text-amber-900">
                  <th className="sticky left-0 bg-amber-50 p-3 text-left font-normal">
                    <Link href="/publicidad/configuracion?section=accounts">
                      Gasto sin tienda →
                    </Link>
                  </th>
                  {columns.map((column) => (
                    <td key={column.id} className="p-3 text-right">
                      {column.id === "all" ? money(numeric(summary.unassignedSpend)) : "—"}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {current.missingCosts > 0 && permissions.profit && (
          <p className="text-sm text-amber-700">
            {current.missingCosts} pedidos tienen productos sin costo: se excluyen del máximo y la
            ganancia.{" "}
            <Link className="underline" href="/productos">
              Cargar costo →
            </Link>
          </p>
        )}
      </Block>
      <Block
        title="Costo por producto · ◐ Estimado"
        tools={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void exportAdsWorkbook(`POWIP_Productos_${fromDate}_${comparison.effectiveTo}`, [
                {
                  name: "Productos",
                  rows: productRows.map((row) => ({
                    Producto: row.name,
                    Tienda: stores.find((store) => store.id === row.storeId)?.name,
                    Anuncios: row.ads,
                    ...(permissions.spend
                      ? { Gasto: row.spend, "Costo por unidad": row.costUnit }
                      : {}),
                    "Unidades entregadas": row.deliveredUnits,
                    "Precio neto": row.netUnitPrice,
                    ...(permissions.profit
                      ? {
                          "Costo + envío/unid.": row.costWithShipping,
                          "Ganancia por unidad": row.gainUnit,
                          "Publicidad / margen": profitUsage(row.costSale, row.maximum),
                        }
                      : {}),
                  })),
                },
              ]).catch(setExportError)
            }
          >
            ↓ Excel
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  "Producto",
                  "Tienda",
                  "N° anuncios",
                  ...(permissions.spend ? ["Gasto"] : []),
                  "Unid. entregadas",
                  ...(permissions.spend ? ["Costo por unidad"] : []),
                  "Precio neto",
                  ...(permissions.profit
                    ? ["Costo + envío/unid.", "Ganancia/unid.", "Publicidad / margen"]
                    : []),
                ].map((label) => (
                  <th key={label} className="whitespace-nowrap p-3 text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr
                  key={`${row.productId}:${row.storeId}`}
                  className={`border-t ${row.ads === 0 ? "text-muted-foreground" : ""}`}
                >
                  <td className="p-3">{row.name}</td>
                  <td className="p-3">
                    {stores.find((store) => store.id === row.storeId)?.name ?? "—"}
                  </td>
                  <td className="p-3">{row.ads}</td>
                  {permissions.spend && <td className="p-3">{money(row.spend)}</td>}
                  <td className="p-3">{row.deliveredUnits}</td>
                  {permissions.spend && <td className="p-3">{money(row.costUnit)}</td>}
                  <td className="p-3">{money(row.netUnitPrice)}</td>
                  {permissions.profit && (
                    <>
                      <td className="p-3">
                        {row.missingCosts ? (
                          <Link href="/productos" className="text-amber-700 underline">
                            — sin costo · Carga el costo
                          </Link>
                        ) : (
                          money(row.costWithShipping)
                        )}
                      </td>
                      <td className="p-3">{money(row.gainUnit)}</td>
                      <td
                        className={`min-w-40 p-3 ${trafficLight(profitUsage(row.costSale, row.maximum), settings!.rules.nearLimitPct).className}`}
                      >
                        <progress
                          className="h-2 w-full"
                          max={100}
                          value={Math.min(100, (profitUsage(row.costSale, row.maximum) ?? 0) * 100)}
                        />{" "}
                        {pct(profitUsage(row.costSale, row.maximum))}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!productRows.length && (
          <p className="text-sm text-muted-foreground">
            Asigna los productos de tus anuncios para comparar su costo.
          </p>
        )}
        <Link
          href="/publicidad/configuracion?section=products"
          className="block rounded-md bg-amber-50 p-3 text-sm text-amber-900"
        >
          Anuncios sin producto o de catálogo · Configurar →
        </Link>
      </Block>
      <Block title="Del pedido a la venta">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Pedidos", count: current.orders },
            { label: "Confirmados", count: current.confirmed },
            { label: "Entregados", count: current.delivered },
            { label: "En camino", count: current.inTransit },
          ].map((stage) => (
            <div key={stage.label} className="rounded-md bg-muted/50 p-4">
              <p className="text-sm">{stage.label}</p>
              <p className="text-xl font-semibold">{stage.count}</p>
              <p className="text-xs text-muted-foreground">
                {pct(ratio(stage.count, current.orders))}
                {permissions.spend ? ` · ${money(ratio(current.spend, stage.count))} c/u` : ""}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Rechazados/anulados:{" "}
          {Math.max(0, current.confirmed - current.delivered - current.inTransit)}
        </p>
      </Block>
      {permissions.spend && <SpendingTimeline summary={summary} sales={sales} storeId={storeId} />}
      {exportError != null && <Failure error={exportError} />}
    </main>
  );
}

function SpendingTimeline({
  summary,
  sales,
  storeId,
}: {
  summary: AdsSummary;
  sales: AdsSales;
  storeId: string;
}) {
  const dates = dateRange(summary.from, summary.to);
  const grouping = dates.length <= 31 ? "day" : dates.length <= 120 ? "week" : "month";
  const groups = new Map<
    string,
    { date: string; spend: number | null; orders: number; current: boolean }
  >();
  for (const date of dates) {
    const key =
      grouping === "day"
        ? date
        : grouping === "month"
          ? date.slice(0, 7)
          : dayKey(
              new Date(parseISO(date).getTime() - ((parseISO(date).getDay() + 6) % 7) * 86_400_000),
            );
    const item = groups.get(key) ?? { date: key, spend: 0, orders: 0, current: false };
    const dailySpend = summarySpendAvailable(summary)
      ? sumSpend(spendRows(summary, storeId).filter((row) => row.date === date))
      : null;
    item.spend = item.spend === null || dailySpend === null ? null : item.spend + dailySpend;
    item.orders += sumSales(
      paidRows(sales.daily, storeId).filter((row) => row.date === date),
    ).orders;
    item.current ||= date === summary.today;
    groups.set(key, item);
  }
  return (
    <Block
      title={`Gasto y pedidos · por ${grouping === "day" ? "día" : grouping === "week" ? "semana" : "mes"}`}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...groups.values()]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="spend" />
            <YAxis yAxisId="orders" orientation="right" />
            <Tooltip />
            <Bar yAxisId="spend" dataKey="spend" name="Gasto" fill="#6366f1">
              {[...groups.values()].map((row) => (
                <Cell key={row.date} fillOpacity={row.current ? 0.45 : 1} />
              ))}
            </Bar>
            <Line yAxisId="orders" dataKey="orders" name="Pedidos" stroke="#111827" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Block>
  );
}

export function MonthlyNumbers() {
  const { storeId } = useAdvertisingStoreFilter();
  const { settings } = useAdsV22();
  const permissions = settings!.capabilities;
  const { setPeriod } = useAdminPeriod();
  const router = useRouter();
  const today = limaToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [weekly, setWeekly] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const from = `${month}-01`;
  const end = dayKey(endOfMonth(parseISO(from)));
  const to = end < today ? end : today;
  const query = useNumbers(from, to, storeId, "month");
  if (query.isError) return <Failure error={query.error} retry={query.refetch} />;
  if (!query.data) return <Skeleton className="h-96" aria-label="Cargando cómo va el mes" />;
  const model = monthlyModel(query.data.summary, query.data.sales, storeId, month);
  const { total } = model;
  const monthRows = model.days.filter((row) => !row.future);
  const weeks = model.weeks;
  const exportRows = monthRows.map((row) => ({
    Día: row.date,
    "Día semana": dateLabel(row.date),
    ...(permissions.spend ? { Gasto: row.spend } : {}),
    Pedidos: row.orders,
    Confirmados: row.confirmed,
    Entregados: row.delivered,
    "En camino": row.inTransit,
    "Unidades entregadas": row.deliveredUnits,
    Facturado: row.revenue,
    ...(permissions.spend
      ? {
          "Costo por pedido": row.costOrder,
          "Costo por venta": row.costSale,
          "Costo por venta proyectado": row.projectedCost,
          "Costo por unidad": row.costUnit,
          ROAS: row.roas,
          "Gasto acumulado": row.cumulativeSpend,
        }
      : {}),
    ...(permissions.profit
      ? {
          Ganancia: row.gain,
          "Ganancia proyectada": row.projectedGain,
          "Ganancia acumulada": row.cumulativeGain,
        }
      : {}),
  }));
  const share = async () => {
    const lines = [
      `POWIP · ${month}`,
      ...(permissions.spend
        ? [
            `Gastado ${money(total.spend)} / presupuesto ${money(model.budget)}`,
            `ROAS ${decimal(total.roas, "×")} · Costo por venta ${money(total.costSale)} (proy. ${money(total.projectedCost)})`,
          ]
        : []),
      `Facturado ${money(total.revenue)}`,
      ...(permissions.profit
        ? [`Ganancia ${money(total.gain)} · proyectada ${money(total.projectedGain)}`]
        : []),
      ...monthRows
        .slice(-7)
        .map(
          (row) =>
            `${dateLabel(row.date)}: ${permissions.spend ? `${money(row.spend)} · ` : ""}${row.orders} pedidos${permissions.spend ? ` · ${money(row.costSale)} por venta` : ""}`,
        ),
    ];
    if (navigator.share) await navigator.share({ text: lines.join("\n") });
    else await navigator.clipboard.writeText(lines.join("\n"));
  };
  const jump = (date: string) => {
    setPeriod(date, date);
    router.push(`/publicidad/anuncios?storeId=${storeId}&from=${date}&to=${date}`);
  };
  const renderCells = (
    row: Financial & {
      cumulativeSpend?: number | null;
      cumulativeGain?: number | null;
      ideal?: number | null;
      date?: string;
    },
  ) => (
    <>
      {permissions.spend && <td>{money(row.spend)}</td>}
      <td>{row.orders}</td>
      <td>
        {row.delivered}
        {row.inTransit > 0 && (
          <em className="block text-xs text-muted-foreground">+{row.inTransit} en camino</em>
        )}
      </td>
      <td>{row.deliveredUnits}</td>
      <td>{money(row.revenue)}</td>
      {permissions.spend && (
        <>
          <td>{money(row.costOrder)}</td>
          <td
            className={
              permissions.profit
                ? trafficLight(row.usage, settings!.rules.nearLimitPct).className
                : ""
            }
          >
            {money(row.costSale)}
            {row.inTransit > 0 && (
              <em className="block text-xs">proy. {money(row.projectedCost)}</em>
            )}
          </td>
          <td>
            {money(row.costUnit)}
            {row.inTransit > 0 && (
              <em className="block text-xs">proy. {money(ratio(row.spend, row.projectedUnits))}</em>
            )}
          </td>
          <td>
            {decimal(row.roas, "×")}
            {row.inTransit > 0 && (
              <em className="block text-xs">proy. {decimal(row.projectedRoas, "×")}</em>
            )}
          </td>
        </>
      )}
      {permissions.profit && (
        <td>
          {money(row.gain)}
          {row.inTransit > 0 && <em className="block text-xs">proy. {money(row.projectedGain)}</em>}
        </td>
      )}
      {permissions.spend && (
        <td
          title={row.ideal != null ? `Ideal: ${money(row.ideal)}` : undefined}
          className={
            row.date &&
            Number(row.date.slice(-2)) >= 3 &&
            row.ideal != null &&
            row.cumulativeSpend != null &&
            row.cumulativeSpend > row.ideal * 1.05
              ? "text-red-600"
              : ""
          }
        >
          {money(row.cumulativeSpend)}
        </td>
      )}
      {permissions.profit && <td>{money(row.cumulativeGain)}</td>}
    </>
  );
  return (
    <>
      {permissions.spend && (
        <div className="grid gap-3 md:grid-cols-2">
          <DailyPace />
          <MetricCard
            label="Ritmo del mes"
            value={money(model.forecast)}
            detail={
              model.budget === null
                ? "Configura el presupuesto del mes para comparar."
                : `${pct(ratio(model.forecast, model.budget))} del presupuesto · máximo ${money(model.maximumDaily)}/día`
            }
          />
        </div>
      )}
      <Block
        title="Cómo va el mes · día por día"
        tools={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs">
              Mes{" "}
              <input
                aria-label="Mes del seguimiento"
                className="rounded border bg-background p-2 text-sm"
                type="month"
                value={month}
                max={today.slice(0, 7)}
                onChange={(event) => {
                  if (
                    /^\d{4}-\d{2}$/.test(event.target.value) &&
                    event.target.value <= today.slice(0, 7)
                  )
                    setMonth(event.target.value);
                }}
              />
            </label>
            <Button size="sm" variant="outline" onClick={() => setWeekly((value) => !value)}>
              {weekly ? "Por día" : "Por semana"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void exportAdsWorkbook(`POWIP_Mes_${month}`, [
                  { name: "Día por día", rows: exportRows },
                ]).catch(setError)
              }
            >
              ↓ Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => void share().catch(setError)}>
              Compartir WhatsApp
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {permissions.spend && (
            <>
              <MetricCard
                label="Gastado en el mes"
                value={money(total.spend)}
                detail={`Ideal a hoy ${money(model.idealToDate)} · presupuesto ${money(model.budget)}`}
              />
              <MetricCard
                label={model.remaining ? "Cierre de gasto proyectado" : "Gasto vs presupuesto"}
                value={money(model.forecast)}
                detail={`${pct(ratio(model.forecast, model.budget))} del presupuesto · máx. ${money(model.maximumDaily)}/día`}
              />
            </>
          )}
          <MetricCard
            label="Facturado acumulado"
            value={money(total.revenue)}
            detail={`${total.delivered} entregados · ${total.inTransit} en camino`}
          />
          {permissions.spend && (
            <MetricCard
              label="Costo por venta del mes"
              value={money(total.costSale)}
              detail={`Proyectado ${money(total.projectedCost)}${permissions.profit ? ` · máximo ${money(total.maximum)}` : ""}`}
            />
          )}
          {permissions.profit && (
            <>
              <MetricCard
                label={model.remaining ? "Ganancia proyectada a hoy" : "Ganancia real"}
                value={money(model.remaining ? total.projectedGain : total.gain)}
                detail={
                  model.remaining
                    ? `Cierre estimado ${money(model.gainForecast)}`
                    : `ROAS ${decimal(total.roas, "×")}`
                }
              />
              <MetricCard
                label="Días que dieron plata"
                value={`${model.profitableDays} de ${model.closedDays}`}
                detail={`Mejor: ${model.best ? dateLabel(model.best) : "—"} · peor: ${model.worst ? dateLabel(model.worst) : "—"}`}
              />
            </>
          )}
        </div>
        {permissions.spend && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={model.days.map((row) => ({
                  ...row,
                  gasto: row.future ? null : row.spend,
                  futuro: row.future ? row.futureSpend : null,
                  acumulado: row.future ? null : row.cumulativeSpend,
                  proyeccion:
                    row.future && model.dailyAverage !== null && total.spend !== null
                      ? total.spend +
                        model.dailyAverage *
                          model.days.filter((day) => day.future && day.date <= row.date).length
                      : null,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => date.slice(-2)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis yAxisId="daily" />
                <YAxis yAxisId="cumulative" orientation="right" />
                <Tooltip labelFormatter={(label) => String(label)} />
                <Bar yAxisId="daily" dataKey="gasto" name="Gasto">
                  {model.days.map((row) => (
                    <Cell
                      key={row.date}
                      fill={
                        permissions.profit
                          ? trafficLight(row.usage, settings!.rules.nearLimitPct).color
                          : "#6366f1"
                      }
                      fillOpacity={row.date === today ? 0.45 : 1}
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="daily"
                  dataKey="futuro"
                  name="Ritmo ideal restante"
                  fill="transparent"
                  stroke="#a5b4fc"
                  strokeDasharray="3 3"
                />
                <Line
                  yAxisId="cumulative"
                  dataKey="acumulado"
                  name="Gasto acumulado"
                  stroke="#111827"
                  dot={false}
                />
                <Line
                  yAxisId="cumulative"
                  dataKey="proyeccion"
                  name="Proyección"
                  stroke="#111827"
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  yAxisId="cumulative"
                  dataKey="ideal"
                  name="Ritmo presupuesto"
                  stroke="#3b82f6"
                  dot={false}
                />
                {model.budget !== null && (
                  <ReferenceLine
                    yAxisId="cumulative"
                    y={model.budget}
                    stroke="#3b82f6"
                    strokeDasharray="5 5"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs [&_td]:whitespace-nowrap [&_td]:p-3 [&_th]:whitespace-nowrap [&_th]:p-3">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card text-left">Día</th>
                {[
                  ...(permissions.spend ? ["Gasto"] : []),
                  "Pedidos",
                  "Entregados + camino",
                  "Unid. entreg.",
                  "Facturado",
                  ...(permissions.spend
                    ? ["C. pedido", "C. venta real / proy.", "C. unidad", "ROAS"]
                    : []),
                  ...(permissions.profit ? ["Ganancia"] : []),
                  ...(permissions.spend ? ["Gasto acum."] : []),
                  ...(permissions.profit ? ["Ganancia acum."] : []),
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.flatMap((subtotal) => {
                const { week, rows } = subtotal;
                return [
                  ...(!weekly
                    ? rows.map((row) => (
                        <tr key={row.date} className="border-t hover:bg-muted/50">
                          <th className="sticky left-0 bg-card text-left font-normal">
                            <button
                              className="text-primary underline-offset-2 hover:underline"
                              onClick={() => jump(row.date)}
                            >
                              {dateLabel(row.date)}
                            </button>
                            {row.date === today && (
                              <span className="block text-xs text-primary">hoy · en curso</span>
                            )}
                            {permissions.profit && row.date === model.best && (
                              <span className="block text-emerald-600">mejor</span>
                            )}
                            {permissions.profit && row.date === model.worst && (
                              <span className="block text-red-600">peor</span>
                            )}
                          </th>
                          {renderCells(row)}
                        </tr>
                      ))
                    : []),
                  <tr key={`week:${week}`} className="border-t bg-muted/50 font-semibold">
                    <th className="sticky left-0 bg-muted text-left">
                      {dateLabel(rows[0].date)} – {dateLabel(rows.at(-1)!.date)}
                    </th>
                    {renderCells(subtotal)}
                  </tr>,
                ];
              })}
              <tr className="border-t font-bold">
                <th className="sticky left-0 bg-card text-left">
                  {model.remaining ? `Mes al ${to.slice(-2)}` : "Mes completo"}
                </th>
                {renderCells({
                  ...total,
                  cumulativeSpend: total.spend ?? undefined,
                  cumulativeGain: total.projectedGain ?? undefined,
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {model.remaining > 0 && permissions.spend && (
          <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm">
            Faltan {model.remaining} días · para cerrar en el presupuesto puedes gastar hasta{" "}
            {money(model.maximumDaily)} por día (hoy promedias {money(model.dailyAverage)}).
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Cada pedido cuenta en el día que entró; se vuelve venta cuando se entrega. Si quedan
          pedidos en camino, el costo en cursiva es el proyectado con la tasa de entrega de los
          últimos 60 días. Un día queda cerrado cuando ya no tiene pedidos en camino.
        </p>
        {error != null && <Failure error={error} />}
      </Block>
    </>
  );
}

function DailyPace() {
  const { storeId } = useAdvertisingStoreFilter();
  const today = limaToday();
  const query = useNumbers(today, today, storeId, "pace-today");
  const catalog = useAdsQuery(["pace-budgets", today, storeId], (identity, signal) =>
    getAllAdsCatalog(identity, { from: today, to: today, level: "ad", storeId }, signal),
  );
  const active =
    catalog.data?.rows.filter(
      (row) => row.effectiveStatus === "ACTIVE" && row.currency === "PEN",
    ) ?? [];
  const budgets = [
    ...new Map(
      active.filter((row) => row.budget).map((row) => [row.budget!.objectId, row.budget!]),
    ).values(),
  ];
  const budget =
    !catalog.data || active.some((row) => !row.budget?.dailyBudget)
      ? null
      : budgets.reduce((sum, row) => sum + (numeric(row.dailyBudget) ?? 0), 0);
  const spent = query.data ? summarize(query.data.summary, query.data.sales, storeId).spend : null;
  return (
    <MetricCard
      label="Ritmo de hoy"
      value={pct(ratio(spent, budget))}
      detail={`${money(spent)} de ${money(budget)} diarios · ${new Set(active.map((row) => row.adsetId).filter(Boolean)).size} conjuntos activos${budget === null ? " · presupuesto diario por confirmar en Meta" : ""}`}
    />
  );
}
