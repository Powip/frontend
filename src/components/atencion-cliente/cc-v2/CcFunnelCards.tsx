"use client";

import { DateRange } from "react-day-picker";
import { useCcKpisFunnel } from "@/hooks/useCcKpisFunnel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

/* ── config de las 5 tarjetas del embudo ──────────────── */
interface FunnelCardConfig {
  key: string;
  title: string;
  getCount: (d: ReturnType<typeof useCcKpisFunnel>["data"]) => number | null;
  getPercentage: (d: ReturnType<typeof useCcKpisFunnel>["data"]) => number | null;
  subtextLabel: string | null;
  isConversion: boolean;
}

const FUNNEL_CARDS: FunnelCardConfig[] = [
  {
    key: "ingresados",
    title: "Ingresados",
    getCount: (d) => d?.ingresados.count ?? 0,
    getPercentage: (_d) => null,
    subtextLabel: "Total de pedidos COD",
    isConversion: false,
  },
  {
    key: "confirmados",
    title: "Confirmados",
    getCount: (d) => d?.confirmados.count ?? 0,
    getPercentage: (d) => d?.confirmados.percentage ?? 0,
    subtextLabel: "% de ingresados",
    isConversion: false,
  },
  {
    key: "despachados",
    title: "Despachados",
    getCount: (d) => d?.despachados.count ?? 0,
    getPercentage: (d) => d?.despachados.percentage ?? 0,
    subtextLabel: "% de confirmados",
    isConversion: false,
  },
  {
    key: "entregados",
    title: "Entregados",
    getCount: (d) => d?.entregados.count ?? 0,
    getPercentage: (d) => d?.entregados.percentage ?? 0,
    subtextLabel: "% de despachados",
    isConversion: false,
  },
  {
    key: "conversion",
    title: "Conversión Final",
    getCount: (_d) => null,
    getPercentage: (d) => d?.conversionFinal.percentage ?? 0,
    subtextLabel: null,
    isConversion: true,
  },
];

/* ── componente ──────────────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcFunnelCards({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcKpisFunnel(storeId, range);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Embudo de Conversión COD
      </h3>

      {isError && (
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar el embudo de conversión. Intentá de nuevo.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {FUNNEL_CARDS.map((card, idx) => {
          const count      = card.getCount(data);
          const percentage = card.getPercentage(data);
          const isLast     = idx === FUNNEL_CARDS.length - 1;

          if (card.isConversion) {
            /* Tarjeta de conversión final — estilo destacado */
            return (
              <div key={card.key} className="flex items-center gap-2 col-span-2 lg:col-span-1">
                {/* Chevron separador en desktop */}
                <ChevronRight className="hidden lg:block h-4 w-4 text-muted-foreground/40 shrink-0 -ml-2" />
                <Card className="flex-1 border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {isLoading ? (
                      <div className="h-8 w-20 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse" />
                    ) : (
                      <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        {percentage !== null ? `${percentage.toFixed(1)}%` : "0.0%"}
                      </p>
                    )}
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                      {isLoading ? "..." : "Ingresados → Entregados"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          }

          /* Tarjetas normales del embudo */
          return (
            <div key={card.key} className="flex items-center gap-2">
              {/* Chevron separador entre tarjetas (desde la 2da en adelante) */}
              {idx > 0 && (
                <ChevronRight className="hidden lg:block h-4 w-4 text-muted-foreground/40 shrink-0 -ml-2" />
              )}
              <Card className="flex-1 border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isLoading ? (
                    <div className="h-7 w-16 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  ) : (
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {count ?? 0}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoading
                      ? "..."
                      : percentage !== null
                        ? `${percentage.toFixed(1)}% ${card.subtextLabel}`
                        : card.subtextLabel}
                  </p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
