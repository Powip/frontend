"use client";

import { DateRange } from "react-day-picker";
import { useCcKpisFunnel } from "@/hooks/useCcKpisFunnel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* ── colores coherentes con CcFunnelCards ─────────────── */
const BAR_COLORS = [
  "#10b981", // emerald-500  — Ingresados
  "#8b5cf6", // violet-500   — Confirmados
  "#f59e0b", // amber-500    — Despachados
  "#ef4444", // red-500      — Entregados
] as const;

/* ── tooltip custom ───────────────────────────────────── */
interface TooltipPayloadEntry {
  value: number;
  payload: {
    name: string;
    count: number;
    percentage: number | null;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, count, percentage } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground mb-0.5">{name}</p>
      <p className="text-muted-foreground">
        {count} pedido{count !== 1 ? "s" : ""}
        {percentage !== null ? ` · ${percentage.toFixed(1)}%` : ""}
      </p>
    </div>
  );
}

/* ── componente ──────────────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcFunnelChart({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcKpisFunnel(storeId, range);

  const chartData = [
    {
      name:       "Ingresados",
      count:      data?.ingresados.count ?? 0,
      percentage: null,
    },
    {
      name:       "Confirmados",
      count:      data?.confirmados.count ?? 0,
      percentage: data?.confirmados.percentage ?? 0,
    },
    {
      name:       "Despachados",
      count:      data?.despachados.count ?? 0,
      percentage: data?.despachados.percentage ?? 0,
    },
    {
      name:       "Entregados",
      count:      data?.entregados.count ?? 0,
      percentage: data?.entregados.percentage ?? 0,
    },
  ];

  return (
    <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50 h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Gráfico del Embudo
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isError && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Error al cargar el gráfico. Intentá de nuevo.
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                <div
                  className="h-5 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"
                  style={{ width: `${80 - i * 12}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
