"use client";

import { DateRange } from "react-day-picker";
import { useCcKpisFinancieros } from "@/hooks/useCcKpisFinancieros";
import { CcKpisFinancierosResponse } from "@/interfaces/IOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, Wallet, TrendingDown, BarChart3 } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

/* ── config de las 5 cards ───────────────────────────── */
interface KpiCardConfig {
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  getValue: (k: CcKpisFinancierosResponse) => number;
  getSubtext: (k: CcKpisFinancierosResponse) => string;
}

const CARD_CONFIGS: KpiCardConfig[] = [
  {
    title: "Facturación confirmada",
    icon: <TrendingUp className="h-5 w-5" />,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    getValue: (k) => k.facturacionConfirmada,
    getSubtext: (k) =>
      `De ${k.countConfirmados} pedido${k.countConfirmados !== 1 ? "s" : ""} confirmado${k.countConfirmados !== 1 ? "s" : ""}`,
  },
  {
    title: "Pendiente de confirmar",
    icon: <Clock className="h-5 w-5" />,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    getValue: (k) => k.pendienteConfirmar,
    getSubtext: (k) =>
      `${k.countPendiente} pedido${k.countPendiente !== 1 ? "s" : ""} por gestionar`,
  },
  {
    title: "Por cobrar",
    icon: <Wallet className="h-5 w-5" />,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    getValue: (k) => k.porCobrar,
    getSubtext: (k) =>
      `De ${k.countPorCobrar} pedido${k.countPorCobrar !== 1 ? "s" : ""} con saldo`,
  },
  {
    title: "Ventas perdidas",
    icon: <TrendingDown className="h-5 w-5" />,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    getValue: (k) => k.ventasPerdidas,
    getSubtext: (k) =>
      `${k.countPerdidos} pedido${k.countPerdidos !== 1 ? "s" : ""} sin cerrar`,
  },
  {
    title: "Ticket promedio",
    icon: <BarChart3 className="h-5 w-5" />,
    colorClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-50 dark:bg-violet-950/30",
    getValue: (k) => k.ticketPromedio,
    getSubtext: (_k) => "Promedio por pedido confirmado",
  },
];

/* ── componente controlado — el range lo provee el padre ── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcFinancialCards({ storeId, range }: Props) {
  const { data: kpis, isLoading, isError } = useCcKpisFinancieros(storeId, range);

  return (
    <div className="space-y-4">
      {isError && (
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar los KPIs financieros. Intentá de nuevo.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {CARD_CONFIGS.map((card) => {
          const value   = kpis ? card.getValue(kpis) : 0;
          const subtext = kpis ? card.getSubtext(kpis) : "—";

          return (
            <Card key={card.title} className={`border-0 shadow-sm ${card.bgClass}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {card.title}
                  </CardTitle>
                  <span className={card.colorClass}>{card.icon}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? (
                  <div className="h-7 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                ) : (
                  <p className={`text-2xl font-bold ${card.colorClass}`}>
                    {formatCurrency(value)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{isLoading ? "..." : subtext}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
