"use client";
import { Fragment, useState } from "react";
import { endOfMonth, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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
import { getNumbersV23 } from "@/services/advertisingV23Service";
import { useAdsQuery, useAdsV22 } from "./context";
import { Block, Failure, MetricCard, SelectField, exportAdsWorkbook } from "./shared";
import { dayKey, decimal, limaToday, money, pct, profitUsage, ratio, trafficLight } from "./model";
import { monthlyV23, scopeDays, v23Financial, v23Scope, type V23Financial } from "./v23-model";
import { advertisingSectionHref } from "../advertising-sections";
type Series = "spend" | "orders" | "revenue";
const dateLabel = (date: string) => format(parseISO(date), "EEE d MMM", { locale: es });
export function MonthlyNumbersV23({
  storeId,
  accountId,
  canSpend,
  canProfit,
}: {
  storeId: string;
  accountId: string;
  canSpend: boolean;
  canProfit: boolean;
}) {
  const today = limaToday(),
    router = useRouter(),
    { setPeriod } = useAdminPeriod(),
    { settings } = useAdsV22();
  const [month, setMonth] = useState(today.slice(0, 7)),
    [weekly, setWeekly] = useState(false),
    [series, setSeries] = useState<Series>(canSpend ? "spend" : "orders"),
    [channel, setChannel] = useState("all");
  const [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const from = `${month}-01`,
    end = dayKey(endOfMonth(parseISO(from))),
    effectiveTo = end < today ? end : today;
  const query = useAdsQuery(["numbers-v23", from, effectiveTo], (identity, signal) =>
    getNumbersV23(identity, from, effectiveTo, signal),
  );
  const actualSeries = !canSpend && series === "spend" ? "orders" : series;
  const controls = (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        Mes
        <input
          aria-label="Mes del seguimiento"
          className="mt-1 block h-9 rounded border bg-background px-2 text-sm"
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => {
            if (
              /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
              e.target.value <= today.slice(0, 7)
            )
              setMonth(e.target.value);
          }}
        />
      </label>
      <SelectField
        label="Serie del gráfico mensual"
        value={actualSeries}
        onChange={(v) => setSeries(v as Series)}
        options={[
          ...(canSpend ? [{ value: "spend", label: "Gasto" }] : []),
          { value: "orders", label: "Pedidos" },
          { value: "revenue", label: "Facturación entregada" },
        ]}
      />
      <SelectField
        label="Canal del seguimiento mensual"
        value={channel}
        onChange={setChannel}
        options={[
          { value: "all", label: "Todos" },
          { value: "messages", label: "Mensajes" },
          { value: "web", label: "Web" },
        ]}
      />
      <Button variant="outline" size="sm" onClick={() => setWeekly((v) => !v)}>
        {weekly ? "Por día" : "Por semana"}
      </Button>
    </div>
  );
  if (query.isError)
    return (
      <Block title="Cómo va el mes · día por día" tools={controls}>
        <Failure error={query.error} retry={query.refetch} />
      </Block>
    );
  if (!query.data)
    return (
      <Block title="Cómo va el mes · día por día" tools={controls}>
        <Skeleton className="h-80" aria-label="Cargando seguimiento mensual" />
      </Block>
    );
  const { summary, sales } = query.data,
    model = monthlyV23(summary, sales, month, storeId, accountId, channel, today),
    { total } = model;
  const rows = v23Scope(sales.daily, summary, storeId, accountId, channel),
    days = scopeDays(summary, storeId, accountId, channel);
  const monthRows = model.data.filter((d) => !d.future),
    last = monthRows.at(-1),
    ideal = last?.ideal ?? null;
  const canShowProfit = canProfit && canSpend,
    threshold = settings?.rules.nearLimitPct ?? 70;
  const groups = [...new Set(monthRows.map((d) => d.week))].map((week) => {
    const dates = monthRows.filter((d) => d.week === week);
    const weekSummary = {
      ...summary,
      from: dates[0].date,
      to: dates.at(-1)!.date,
      quality: {
        ...summary.quality,
        spendScopes: summary.quality.spendScopes?.map((scope) => ({
          ...scope,
          spendAvailable: dates.every(
            (date) => scope.days.find((d) => d.date === date.date)?.spendAvailable === true,
          ),
        })),
      },
    };
    return {
      week,
      dates,
      metric: v23Financial(
        rows.filter((r) => dates.some((d) => d.date === r.date)),
        weekSummary,
        sales,
        storeId,
        accountId,
        channel,
        days.filter((r) => dates.some((d) => d.date === r.date)),
      ),
      last: dates.at(-1)!,
    };
  });
  const valueFor = (metric: V23Financial) =>
    actualSeries === "spend"
      ? metric.spend
      : actualSeries === "orders"
        ? metric.ordersNet
        : metric.deliveredRevenueValue;
  const average = monthRows.filter((d) => d.closed),
    averageKnown = average.length && average.every((d) => valueFor(d.metric) !== null),
    dailyAverage = averageKnown
      ? average.reduce((n, d) => n + valueFor(d.metric)!, 0) / average.length
      : null;
  let accumulated: number | null = 0;
  const seriesTotal = valueFor(total),
    title =
      actualSeries === "spend"
        ? "Gasto"
        : actualSeries === "orders"
          ? "Pedidos"
          : "Facturación entregada";
  const graph = model.data.map((d, index) => {
    const value = valueFor(d.metric);
    if (!d.future)
      accumulated = accumulated === null || value === null ? null : accumulated + value;
    return {
      date: d.date,
      value: d.future ? null : value,
      future:
        actualSeries === "spend" && d.future && model.budget !== null
          ? model.budget / model.data.length
          : null,
      accumulated: d.future ? null : accumulated,
      projection:
        d.future && dailyAverage !== null && seriesTotal !== null
          ? seriesTotal + dailyAverage * (index - monthRows.length + 1)
          : null,
      ideal: actualSeries === "spend" ? d.ideal : null,
      metric: d.metric,
    };
  });
  const exportRows = model.data.map((d) => ({
    Día: d.date,
    Estado: d.future
      ? "Por transcurrir"
      : d.date === today
        ? "Hoy · en curso"
        : d.metric.inTransit > 0
          ? "En camino"
          : "Cerrado",
    ...(canSpend ? { Gasto: d.future ? null : d.metric.spend } : {}),
    Pedidos: d.future ? null : d.metric.ordersNet,
    Productos: d.future ? null : d.metric.units,
    "Facturación ingresada": d.future ? null : d.metric.enteredRevenue,
    ...(canSpend
      ? { CPV: d.future ? null : d.metric.cpv, CPP: d.future ? null : d.metric.cpp }
      : {}),
    Confirmadas: d.future ? null : d.metric.confirmed,
    Entregados: d.future ? null : d.metric.delivered,
    "En camino": d.future ? null : d.metric.inTransit,
    "Unidades entregadas": d.future ? null : d.metric.deliveredUnits,
    "Facturación entregada": d.future ? null : d.metric.deliveredRevenueValue,
    ...(canSpend
      ? {
          "Costo por venta entregada": d.future ? null : d.metric.costDelivered,
          "Costo por venta entregada proyectado": d.future ? null : d.metric.projectedCost,
          "ROAS entregado": d.future ? null : d.metric.roasDelivered,
          "ROAS entregado proyectado": d.future ? null : d.metric.projectedRoas,
          "Gasto acumulado": d.accumulatedSpend,
        }
      : {}),
    ...(canShowProfit
      ? {
          Ganancia: d.future ? null : d.metric.gain,
          "Ganancia proyectada": d.future ? null : d.metric.projectedGain,
          "Ganancia acumulada": d.accumulatedGain,
        }
      : {}),
  }));
  const shareText = [
    `POWIP · Publicidad · ${format(parseISO(from), "MMMM yyyy", { locale: es })}`,
    `Tienda: ${summary.stores.find((s) => s.id === storeId)?.name ?? "Todo el negocio"} · Canal: ${channel === "all" ? "Todos" : channel === "web" ? "Web" : "Mensajes"}`,
    ...(total.estimated ? ["◐ Ventas estimadas según resultados de Meta."] : []),
    ...(canSpend
      ? [
          `Gastado: ${money(total.spend)} / presupuesto: ${money(model.budget)}`,
          `CPV: ${money(total.cpv)} · CPP: ${money(total.cpp)}`,
          `ROAS ingresado: ${decimal(total.roasEntered, "×")} · entregado: ${decimal(total.roasDelivered, "×")}`,
          `Costo por venta entregada: ${money(total.costDelivered)} · proyectado: ${money(total.projectedCost)}`,
        ]
      : []),
    `Facturación entregada: ${money(total.deliveredRevenueValue)} · ${decimal(total.delivered)} entregados · ${decimal(total.inTransit)} en camino`,
    ...(canShowProfit
      ? [
          `Ganancia: ${money(total.gain)} · proyectada a hoy: ${money(total.projectedGain)} · cierre estimado: ${money(model.projectedGain)}`,
        ]
      : []),
    "Últimos 7 días:",
    ...monthRows
      .slice(-7)
      .map(
        (d) =>
          `${dateLabel(d.date)}: ${canSpend ? `${money(d.metric.spend)} · ` : ""}${decimal(d.metric.ordersNet)} pedidos${canSpend ? ` · CPV ${money(d.metric.cpv)}` : ""}`,
      ),
  ].join("\n");
  const share = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (navigator.clipboard?.writeText)
      void navigator.clipboard
        .writeText(shareText)
        .then(() =>
          setNotice(
            "Resumen copiado y abierto en WhatsApp. Revisa el destinatario antes de enviarlo.",
          ),
        )
        .catch(() => setNotice("Resumen abierto en WhatsApp para revisar y enviar."));
    else setNotice("Resumen abierto en WhatsApp para revisar y enviar.");
  };
  const jump = (date: string) => {
    setPeriod(date, date);
    router.push(
      advertisingSectionHref("/publicidad/anuncios", date, date, {
        storeId,
        adAccountId: accountId,
      }),
    );
  };
  const renderCells = (
    metric: V23Financial,
    accumulatedSpend: number | null,
    accumulatedGain: number | null,
    date?: string,
    idealDay?: number | null,
  ) => {
    const projected = metric.inTransit > 0,
      usage = profitUsage(projected ? metric.projectedCost : metric.costDelivered, metric.maximum);
    return (
      <>
        {canSpend ? <td>{money(metric.spend)}</td> : null}
        <td>{decimal(metric.ordersNet)}</td>
        <td>{decimal(metric.units)}</td>
        <td>{money(metric.enteredRevenue)}</td>
        {canSpend ? (
          <>
            <td>{money(metric.cpv)}</td>
            <td>{money(metric.cpp)}</td>
          </>
        ) : null}
        <td>
          {decimal(metric.delivered)}
          {metric.inTransit > 0 ? (
            <span className="block text-xs text-muted-foreground">
              + {decimal(metric.inTransit)} en camino
            </span>
          ) : null}
        </td>
        <td>{money(metric.deliveredRevenueValue)}</td>
        {canSpend ? (
          <>
            <td className={canShowProfit ? trafficLight(usage, threshold).className : ""}>
              {projected ? (
                <em title="Proyección con la tasa histórica de entrega de 60 días">
                  {money(metric.projectedCost)} proy.
                </em>
              ) : (
                money(metric.costDelivered)
              )}
            </td>
            <td>
              {projected ? (
                <em>{decimal(metric.projectedRoas, "×")} proy.</em>
              ) : (
                decimal(metric.roasDelivered, "×")
              )}
            </td>
          </>
        ) : null}
        {canShowProfit ? (
          <td>{projected ? <em>{money(metric.projectedGain)} proy.</em> : money(metric.gain)}</td>
        ) : null}
        {canSpend ? (
          <td
            className={
              date &&
              Number(date.slice(-2)) >= 3 &&
              idealDay != null &&
              accumulatedSpend != null &&
              accumulatedSpend > idealDay * 1.05
                ? "text-red-600"
                : ""
            }
            title={idealDay != null ? `Ideal: ${money(idealDay)}` : undefined}
          >
            {money(accumulatedSpend)}
          </td>
        ) : null}
        {canShowProfit ? <td>{money(accumulatedGain)}</td> : null}
      </>
    );
  };
  const columnCount = 6 + (canSpend ? 6 : 0) + (canShowProfit ? 2 : 0);
  return (
    <div id="mes-publicidad" className="space-y-4">
      {canSpend ? (
        <MetricCard
          label="Ritmo del mes"
          value={money(model.projectedSpend)}
          detail={
            model.budget === null
              ? accountId !== "all" || channel !== "all"
                ? "El presupuesto es por tienda. Selecciona todas las cuentas y canales para compararlo."
                : "Configura el presupuesto mensual de cada tienda para comparar el ritmo."
              : model.projectedSpend !== null && model.projectedSpend > model.budget
                ? `Te pasarías ${money(model.projectedSpend - model.budget)}. Para cerrar en ${money(model.budget)}, gasta como máximo ${money(model.maxDaily)} por día.`
                : `${pct(ratio(model.projectedSpend, model.budget))} del presupuesto · máximo ${money(model.maxDaily)}/día`
          }
        />
      ) : null}
      <Block
        title="Cómo va el mes · día por día"
        tools={
          <div className="flex flex-wrap items-end gap-2">
            {controls}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void exportAdsWorkbook(
                  `POWIP_Publicidad_ComoVaElMes_${format(parseISO(from), "ddMMM", { locale: es })}-${format(parseISO(end), "ddMMM", { locale: es })}_${month.slice(0, 4)}`,
                  [{ name: "Cómo va el mes", rows: exportRows }],
                ).catch(setError)
              }
            >
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={share}>
              WhatsApp
            </Button>
          </div>
        }
      >
        <p className="text-xs text-muted-foreground">
          Este bloque siempre muestra el mes completo. El período de arriba sigue aplicándose al
          resto de Publicidad.
        </p>
        {canSpend && total.spend === null && (
          <p
            role="status"
            className="rounded border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900"
          >
            Hay días del mes sin gasto completo o conciliado. Se conservan los días disponibles y
            las proyecciones quedan pendientes hasta completar la cobertura.
          </p>
        )}
        {total.estimated ? (
          <p className="rounded bg-blue-50 p-2 text-xs text-blue-800">
            ◐ Estimado · Las ventas sin ID se reparten según los resultados de Meta dentro de cada
            tienda y canal.
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}
        {error ? <Failure error={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {canSpend ? (
            <>
              <MetricCard
                label="Gastado en el mes"
                value={
                  <span
                    className={
                      ideal !== null && total.spend !== null && total.spend > ideal * 1.03
                        ? "text-red-600"
                        : ""
                    }
                  >
                    {money(total.spend)}
                  </span>
                }
                detail={`Ideal a hoy ${money(ideal)} · presupuesto ${money(model.budget)}`}
              />
              <MetricCard
                label={model.remaining ? "Cierre de gasto proyectado" : "Gasto vs presupuesto"}
                value={
                  <span
                    className={
                      model.budget !== null &&
                      model.projectedSpend !== null &&
                      model.projectedSpend > model.budget
                        ? "text-red-600"
                        : ""
                    }
                  >
                    {money(model.projectedSpend)}
                  </span>
                }
                detail={`${pct(ratio(model.projectedSpend, model.budget))} del presupuesto · máx. ${money(model.maxDaily)}/día`}
              />
            </>
          ) : null}
          <MetricCard
            label="Facturado acumulado"
            value={money(total.deliveredRevenueValue)}
            detail={`${decimal(total.delivered)} entregados · ${decimal(total.inTransit)} en camino`}
          />
          {canSpend ? (
            <MetricCard
              label="Costo por venta entregada del mes"
              value={money(total.costDelivered)}
              detail={`Proyectado ${money(total.projectedCost)}${canShowProfit ? ` · máximo ${money(total.maximum)}` : ""}`}
            />
          ) : null}
          {canShowProfit ? (
            <>
              <MetricCard
                label={model.remaining ? "Ganancia proyectada a hoy" : "Ganancia real"}
                value={money(model.remaining ? total.projectedGain : total.gain)}
                detail={
                  model.remaining
                    ? `Cierre estimado ${money(model.projectedGain)}`
                    : `ROAS entregado ${decimal(total.roasDelivered, "×")}`
                }
              />
              <MetricCard
                label="Días que dieron plata"
                value={model.closed ? `${model.profitable} de ${model.closed}` : "—"}
                detail={`Mejor: ${model.best ? dateLabel(model.best) : "—"} · peor: ${model.worst ? dateLabel(model.worst) : "—"}`}
              />
            </>
          ) : null}
        </div>
        {canShowProfit && total.missingCostOrders > 0 ? (
          <p className="text-xs text-amber-800">
            Carga el costo: {decimal(total.missingCostOrders)} pedidos no entran en el margen ni en
            el máximo por venta.
          </p>
        ) : null}
        <div
          className="h-80"
          role="img"
          aria-label={`Gráfico mensual de ${title.toLocaleLowerCase("es")}, con todos los días del mes`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={graph}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => String(v).slice(-2)}
                tick={{ fontSize: 11 }}
              />
              <YAxis yAxisId="daily" />
              <YAxis yAxisId="accumulated" orientation="right" />
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as
                    | {
                        date: string;
                        value: number | null;
                        future: number | null;
                        metric: V23Financial;
                      }
                    | undefined;
                  if (!active || !point) return null;
                  const future = point.date > effectiveTo;
                  return (
                    <div className="space-y-1 rounded-lg border bg-card p-3 text-xs shadow-sm">
                      <p className="font-semibold">
                        {dateLabel(point.date)}
                        {future ? " · por transcurrir" : ""}
                      </p>
                      {future ? (
                        <p>Ritmo ideal: {money(point.future)}</p>
                      ) : (
                        <>
                          <p>
                            {title}:{" "}
                            {actualSeries === "orders" ? decimal(point.value) : money(point.value)}
                          </p>
                          {canSpend && actualSeries !== "spend" ? (
                            <p>Gasto: {money(point.metric.spend)}</p>
                          ) : null}
                          <p>Pedidos: {decimal(point.metric.ordersNet)}</p>
                          {canSpend ? <p>CPV: {money(point.metric.cpv)}</p> : null}
                        </>
                      )}
                    </div>
                  );
                }}
              />
              <Bar yAxisId="daily" dataKey="value" name={title}>
                {model.data.map((d) => (
                  <Cell
                    key={d.date}
                    fill={
                      actualSeries === "spend" && canShowProfit
                        ? trafficLight(
                            profitUsage(
                              d.metric.inTransit > 0
                                ? d.metric.projectedCost
                                : d.metric.costDelivered,
                              d.metric.maximum,
                            ),
                            threshold,
                          ).color
                        : actualSeries === "revenue"
                          ? "#0d9488"
                          : "#7c3aed"
                    }
                    fillOpacity={d.date === today ? 0.45 : 1}
                  />
                ))}
              </Bar>
              {actualSeries === "spend" ? (
                <Bar
                  yAxisId="daily"
                  dataKey="future"
                  name="Ritmo ideal restante"
                  fill="transparent"
                  stroke="#a5b4fc"
                  strokeDasharray="3 3"
                />
              ) : null}
              <Line
                yAxisId="accumulated"
                dataKey="accumulated"
                name={`${title} acumulado`}
                stroke="#111827"
                dot={false}
              />
              <Line
                yAxisId="accumulated"
                dataKey="projection"
                name="Proyección de cierre"
                stroke="#111827"
                strokeDasharray="4 4"
                dot={false}
              />
              {actualSeries === "spend" ? (
                <Line
                  yAxisId="accumulated"
                  dataKey="ideal"
                  name="Ritmo del presupuesto"
                  stroke="#3b82f6"
                  dot={false}
                />
              ) : null}
              {actualSeries === "spend" && model.budget !== null ? (
                <ReferenceLine
                  yAxisId="accumulated"
                  y={model.budget}
                  stroke="#3b82f6"
                  strokeDasharray="5 5"
                  label="Presupuesto"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table
            title="—: sin denominador mayor que cero, gasto completo o costo histórico verificable."
            className="w-full text-right text-xs [&_td]:whitespace-nowrap [&_td]:p-3 [&_th]:whitespace-nowrap [&_th]:p-3"
          >
            <thead className="bg-muted/50">
              <tr>
                <th className="sticky left-0 z-10 bg-card text-left">Día</th>
                {[
                  ...(canSpend ? ["Gasto"] : []),
                  "Pedidos",
                  "Productos",
                  "Facturación ingresada",
                  ...(canSpend ? ["CPV", "CPP"] : []),
                  "Entregados + en camino",
                  "Facturación entregada",
                  ...(canSpend ? ["Costo por venta entregada", "ROAS entregado"] : []),
                  ...(canShowProfit ? ["Ganancia"] : []),
                  ...(canSpend ? ["Gasto acumulado"] : []),
                  ...(canShowProfit ? ["Ganancia acumulada"] : []),
                ].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.week}>
                  {!weekly
                    ? group.dates.map((d) => (
                        <tr key={d.date} className="border-t hover:bg-muted/40">
                          <th className="sticky left-0 z-10 bg-card text-left font-normal">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => jump(d.date)}
                            >
                              {dateLabel(d.date)}
                            </button>
                            {d.date === today ? (
                              <span className="block text-primary">hoy · en curso</span>
                            ) : null}
                            {canShowProfit && d.date === model.best ? (
                              <span className="block text-emerald-700">mejor</span>
                            ) : null}
                            {canShowProfit && d.date === model.worst ? (
                              <span className="block text-red-600">peor</span>
                            ) : null}
                          </th>
                          {renderCells(
                            d.metric,
                            d.accumulatedSpend,
                            d.accumulatedGain,
                            d.date,
                            d.ideal,
                          )}
                        </tr>
                      ))
                    : null}
                  <tr className="border-t bg-muted/50 font-semibold">
                    <th className="sticky left-0 z-10 bg-muted text-left">
                      Semana {group.dates[0].date.slice(-2)}–{group.last.date.slice(-2)}
                    </th>
                    {renderCells(
                      group.metric,
                      group.last.accumulatedSpend,
                      group.last.accumulatedGain,
                    )}
                  </tr>
                </Fragment>
              ))}
              {model.remaining ? (
                <tr className="border-t bg-muted/30">
                  <td colSpan={columnCount} className="text-left italic">
                    Faltan {model.remaining} días
                    {canSpend
                      ? ` · para cerrar en el presupuesto puedes gastar hasta ${money(model.maxDaily)} por día (promedio actual ${money(model.dailyAverage)})`
                      : ""}
                  </td>
                </tr>
              ) : null}
              <tr className="border-t-2 bg-violet-50 font-bold dark:bg-violet-950/20">
                <th className="sticky left-0 z-10 bg-violet-50 text-left dark:bg-violet-950">
                  {model.remaining ? `Mes al ${effectiveTo.slice(-2)}` : "Mes completo"}
                </th>
                {renderCells(total, total.spend, total.projectedGain)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada pedido cuenta el día que entró y se sigue hasta su entrega. Si quedan pedidos en
          camino, las cifras en cursiva se proyectan con la tasa histórica de entrega de 60 días. En
          Shopify COD el lead cuenta como pedido el día en que se convierte.
        </p>
      </Block>
    </div>
  );
}
