"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { CcFinancialCards } from "./CcFinancialCards";
import { CcFunnelCards } from "./CcFunnelCards";
import { CcFunnelChart } from "./CcFunnelChart";
import { CcDistribucionBar } from "./CcDistribucionBar";
import { CcStorePerformanceCard } from "./CcStorePerformanceCard";
import { CcUpsellByStoreCard } from "./CcUpsellByStoreCard";
import { CcAgingHeatmap } from "./CcAgingHeatmap";
import { CcIntentosCard } from "./CcIntentosCard";
import { CcUpsellRecordsTable } from "./CcUpsellRecordsTable";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

/* ── helpers de fecha (sin date-fns) ──────────────────── */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function endOfPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0);
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDateRange(range: DateRange): string {
  if (!range.from) return "Seleccionar período";
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  const from = range.from.toLocaleDateString("es-PE", opts);
  if (!range.to) return from;
  const to = range.to.toLocaleDateString("es-PE", opts);
  return `${from} – ${to}`;
}

/* ── presets ─────────────────────────────────────────── */
const PRESETS = [
  {
    label: "7D",
    getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: "15D",
    getRange: () => ({ from: subDays(new Date(), 15), to: new Date() }),
  },
  {
    label: "Este mes",
    getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    label: "Mes anterior",
    getRange: () => ({
      from: startOfPrevMonth(new Date()),
      to: endOfPrevMonth(new Date()),
    }),
  },
] as const;

/* ── componente contenedor ───────────────────────────── */
interface Props {
  storeId: string;
}

export function CcMovimientosTab({ storeId }: Props) {
  const [range, setRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* ── selector de período compartido ──────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => setRange(preset.getRange())}
          >
            {preset.label}
          </Button>
        ))}

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-start">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatDateRange(range)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => {
                if (r) {
                  setRange(r);
                  if (r.from && r.to) setCalendarOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* ── KPIs financieros ─────────────────────────── */}
      <CcFinancialCards storeId={storeId} range={range} />

      {/* ── Embudo de conversión COD ─────────────────── */}
      <CcFunnelCards storeId={storeId} range={range} />

      {/* ── Distribución de estados COD ──────────────── */}
      <CcDistribucionBar storeId={storeId} range={range} />

      {/* ── Gráfico de embudo + Rendimiento por tienda ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CcFunnelChart storeId={storeId} range={range} />
        </div>
        <div className="lg:col-span-1">
          <CcStorePerformanceCard storeId={storeId} range={range} />
        </div>
      </div>

      {/* ── Upsell por tienda ────────────────────────── */}
      <CcUpsellByStoreCard storeId={storeId} range={range} />

      {/* ── Aging heatmap ────────────────────────────── */}
      <CcAgingHeatmap storeId={storeId} range={range} />

      {/* ── Análisis de intentos (Fase 7) ────────────── */}
      <CcIntentosCard storeId={storeId} range={range} />

      {/* ── Detalle de upsell (FEAT-04) ──────────────── */}
      <CcUpsellRecordsTable storeId={storeId} range={range} />
    </div>
  );
}
