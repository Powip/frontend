"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdvertisingSummaryCurrencyV11,
  AdvertisingSummaryV11,
} from "@/services/advertisingV11Service";
import { divideOrderDecimals } from "./advertising-business-results";
import {
  advertisingCurrencyDigits,
  advertisingDecimalToMinor,
  sumAdvertisingDecimals,
} from "./advertising-decimal";
import { formatMetaSpend } from "./advertising-meta-model";
import { formatAdvertisingDate } from "./advertising-model";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export function advertisingSegmentColor(color: string | null | undefined, index: number) {
  return color && /^#[a-f\d]{6}$/i.test(color) ? color : PALETTE[index % PALETTE.length];
}

export function advertisingStackedSeries(
  summary: AdvertisingSummaryV11,
  total: AdvertisingSummaryCurrencyV11,
) {
  const source = summary.series.filter((row) => row.currency === total.currency);
  const segments = [
    ...new Map(
      source.map((row) => [`${row.segment.type}:${row.segment.id}`, row.segment]),
    ).entries(),
  ].map(([id, segment], index) => ({
    ...segment,
    id,
    key: `segment-${index}`,
    color: advertisingSegmentColor(segment.color, index),
    amount: sumAdvertisingDecimals(
      source
        .filter((row) => `${row.segment.type}:${row.segment.id}` === id)
        .map((row) => row.spend),
    ),
  }));
  const totalAvailable = sumAdvertisingDecimals(segments.map((segment) => segment.amount));
  const withPercentage = segments.map((segment) => {
    const ratio =
      segment.amount !== null && totalAvailable !== null
        ? divideOrderDecimals(segment.amount, totalAvailable, 6)
        : null;
    return {
      ...segment,
      percentage:
        ratio === null
          ? null
          : new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 }).format(
              Number(ratio),
            ),
    };
  });
  const start = Date.parse(`${summary.from}T00:00:00Z`),
    end = Date.parse(`${summary.to}T00:00:00Z`);
  const count = (end - start) / 86_400_000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 366) throw new Error("Periodo inválido");
  const completeDates = new Set(total.completeDates ?? []);
  const days = Array.from({ length: count }, (_, offset) => {
    const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    const observed = source.filter((row) => row.date === date);
    const amounts = Object.fromEntries(
      segments.map((segment) => {
        const matching = observed.filter(
          (row) => `${row.segment.type}:${row.segment.id}` === segment.id,
        );
        return [
          segment.key,
          matching.length
            ? sumAdvertisingDecimals(matching.map((row) => row.spend))
            : completeDates.has(date)
              ? "0"
              : null,
        ];
      }),
    );
    const spend = observed.length
      ? sumAdvertisingDecimals(observed.map((row) => row.spend))
      : completeDates.has(date)
        ? "0"
        : null;
    const chart = Object.fromEntries(
      segments.map((segment) => [
        segment.key,
        advertisingDecimalToMinor(amounts[segment.key], total.currency),
      ]),
    );
    return { date, spend, complete: completeDates.has(date), amounts, ...chart };
  });
  return { segments: withPercentage, days };
}

export function AdvertisingStackedSpendChart({
  summary,
  total,
}: {
  summary: AdvertisingSummaryV11;
  total: AdvertisingSummaryCurrencyV11;
}) {
  const data = useMemo(() => {
    try {
      return advertisingStackedSeries(summary, total);
    } catch {
      return null;
    }
  }, [summary, total]);
  if (!data)
    return (
      <p role="alert" className="text-sm">
        Revisa los datos de gasto antes de graficar.
      </p>
    );
  const { segments, days } = data;
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Gasto diario · {total.currency}</CardTitle>
        <Badge variant="outline">
          {total.coverage === "complete" ? "Datos completos" : "Gasto disponible"}
        </Badge>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {segments.length ? (
          <div
            className="h-60 w-full"
            role="img"
            aria-label={`Gasto diario por ${summary.seriesBy === "store" ? "tienda" : summary.seriesBy === "account" ? "cuenta" : "objetivo"} en ${total.currency}. Datos exactos en la tabla inferior.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={days}
                accessibilityLayer
                margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAdvertisingDate}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  width={48}
                  tickFormatter={(amount: number) =>
                    new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(
                      amount / 10 ** advertisingCurrencyDigits(total.currency),
                    )
                  }
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ active, label }) => {
                    if (!active) return null;
                    const day = days.find((item) => item.date === label);
                    if (!day) return null;
                    return (
                      <div className="space-y-2 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                        <p className="font-medium">
                          {formatAdvertisingDate(day.date)} ·{" "}
                          {formatMetaSpend(day.spend, total.currency)}
                        </p>
                        {segments.map((segment) => (
                          <p key={segment.key} className="flex justify-between gap-5">
                            <span>{segment.name}</span>
                            <span className="font-mono tabular-nums">
                              {formatMetaSpend(day.amounts[segment.key], total.currency)}
                            </span>
                          </p>
                        ))}
                        {!day.complete ? (
                          <p className="text-muted-foreground">Datos parciales</p>
                        ) : null}
                      </div>
                    );
                  }}
                />
                {segments.map((segment) => (
                  <Bar
                    key={segment.key}
                    dataKey={segment.key}
                    name={segment.name}
                    stackId="spend"
                    fill={segment.color}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            Sin detalle diario disponible para estos filtros.
          </p>
        )}
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Desglose de gasto">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span>{segment.name}</span>
              <span className="font-mono tabular-nums">
                {formatMetaSpend(segment.amount, total.currency)}
                {segment.percentage ? ` · ${segment.percentage}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {total.coverage !== "complete" ? (
          <p className="text-xs text-muted-foreground">
            Las barras incluyen solo datos disponibles; los días pendientes no cuentan como cero.
          </p>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary focus-visible:outline-ring">
            Ver datos diarios
          </summary>
          <Table aria-label={`Gasto diario desglosado en ${total.currency}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                {segments.map((segment) => (
                  <TableHead key={segment.key} className="text-right">
                    {segment.name}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatAdvertisingDate(day.date)}</TableCell>
                  {segments.map((segment) => (
                    <TableCell key={segment.key} className="text-right font-mono tabular-nums">
                      {formatMetaSpend(day.amounts[segment.key], total.currency)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMetaSpend(day.spend, total.currency)}
                  </TableCell>
                  <TableCell>{day.complete ? "Completo" : "Pendiente / parcial"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </CardContent>
    </Card>
  );
}
