"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { advertisingCurrencyDigits } from "./advertising-decimal";
import {
  type AdvertisingDailyAmount,
  formatAdvertisingDate,
  formatAdvertisingMoney,
  isAdvertisingZero,
} from "./advertising-model";

export default function AdvertisingSpendChart({
  currency,
  days,
  today,
}: {
  currency: string;
  days: AdvertisingDailyAmount[];
  today: string;
}) {
  const patternId = `ads-partial-${useId().replace(/:/g, "")}`;
  const hasPartial = days.some((day) => !day.complete);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gasto diario · {currency}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div
          className="h-56 w-full"
          role="img"
          aria-label={`Gasto diario en ${currency}. Valores y días pendientes en la tabla inferior.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={days}
              accessibilityLayer
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="var(--chart-1)" fillOpacity="0.25" />
                  <path
                    d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6"
                    stroke="var(--chart-1)"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => formatAdvertisingDate(date)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                width={48}
                tickFormatter={(amount: number) =>
                  new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(
                    amount / 10 ** advertisingCurrencyDigits(currency),
                  )
                }
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                labelFormatter={(date) => formatAdvertisingDate(String(date))}
                formatter={(amount, _name, item) => [
                  typeof amount === "number"
                    ? formatAdvertisingMoney(amount, currency, item.payload?.amountDecimal)
                    : "Pendiente",
                  item.payload?.complete === false ? "Gasto disponible · datos parciales" : "Gasto",
                ]}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  borderColor: "var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar
                dataKey="amountMinor"
                name="Gasto"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              >
                {days.map((day) => (
                  <Cell
                    key={day.date}
                    fill={day.complete ? "var(--chart-1)" : `url(#${patternId})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {hasPartial ? (
          <p className="text-xs text-muted-foreground">Rayado: datos parciales.</p>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary focus-visible:outline-ring">
            Ver gasto por día
          </summary>
          <Table aria-label={`Gasto diario en ${currency}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead className="text-right">Gasto {currency}</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatAdvertisingDate(day.date)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatAdvertisingMoney(day.amountMinor, currency, day.amountDecimal)}
                  </TableCell>
                  <TableCell>
                    {!day.complete
                      ? "Datos parciales"
                      : isAdvertisingZero(day.amountMinor, day.amountDecimal)
                        ? "Cero confirmado"
                        : day.provisional || day.date === today
                          ? "Puede cambiar"
                          : "Disponible"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </CardContent>
    </Card>
  );
}
