"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileDown } from "lucide-react";
import { toast } from "sonner";
import { CcCierreDiaDayView } from "./CcCierreDiaDayView";
import { CcCierreDiaRangoView } from "./CcCierreDiaRangoView";
import { CcCierreDiaMesView } from "./CcCierreDiaMesView";
import { CcCierreDiaModal } from "./CcCierreDiaModal";
import { todayISO } from "./cierreDiaUtils";

type ViewMode = "dia" | "rango" | "mes";

interface Props {
  storeId: string;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export function CcCierreDiaTab({ storeId }: Props) {
  const [mode, setMode] = useState<ViewMode>("dia");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [range, setRange] = useState<DateRange>({ from: subDays(new Date(), 6), to: new Date() });
  const [monthStr, setMonthStr] = useState(currentMonthStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* date bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 border rounded-lg px-3.5 py-2.5">
        <div className="flex border rounded-md overflow-hidden">
          {(
            [
              { key: "dia", label: "📅 Día" },
              { key: "rango", label: "🗓 Rango" },
              { key: "mes", label: "📆 Mes" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setMode(v.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === v.key
                  ? "bg-teal-600 text-white"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {mode === "dia" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Fecha:</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-40"
            />
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayISO())}>
              Hoy
            </Button>
          </div>
        )}

        {mode === "rango" && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-start">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">
                  {range.from
                    ? `${range.from.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} – ${
                        (range.to ?? range.from).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
                      }`
                    : "Seleccionar período"}
                </span>
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
        )}

        {mode === "mes" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Mes:</label>
            <Input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className="h-8 w-40"
            />
          </div>
        )}

        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info("La exportación a Excel del Cierre del Día estará disponible próximamente.")}
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" /> Excel
        </Button>
      </div>

      {mode === "dia" && (
        <CcCierreDiaDayView storeId={storeId} date={selectedDate} onRegularizar={setModalDate} />
      )}
      {mode === "rango" && (
        <CcCierreDiaRangoView storeId={storeId} range={range} onRegularizar={setModalDate} />
      )}
      {mode === "mes" && (
        <CcCierreDiaMesView
          storeId={storeId}
          monthStr={monthStr}
          onRegularizar={setModalDate}
          onVerDia={(date) => {
            setSelectedDate(date);
            setMode("dia");
          }}
        />
      )}

      <CcCierreDiaModal
        storeId={storeId}
        date={modalDate}
        onClose={() => setModalDate(null)}
      />
    </div>
  );
}
