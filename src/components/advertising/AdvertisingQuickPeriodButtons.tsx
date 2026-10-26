"use client";

import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";

type QuickPeriod = "today" | "yesterday" | "7d" | "30d" | "month";
const PERIODS: Array<{ value: QuickPeriod; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "7d", label: "7 días" },
  { value: "month", label: "Mes" },
];

export function advertisingQuickRange(period: QuickPeriod, now = new Date()) {
  if (period === "month")
    return {
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  const to = period === "yesterday" ? subDays(now, 1) : now;
  const from = period === "7d" ? subDays(to, 6) : period === "30d" ? subDays(to, 29) : to;
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
}

export function AdvertisingQuickPeriodButtons() {
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  return (
    <fieldset
      className="inline-flex min-w-0 shrink-0 flex-wrap gap-0.5 rounded-lg bg-muted p-0.5"
      aria-label="Periodos de publicidad"
    >
      {PERIODS.map(({ value, label }) => {
        const range = advertisingQuickRange(value);
        const selected = range.from === fromDate && range.to === toDate;
        return (
          <Button
            key={value}
            size="sm"
            variant={selected ? "secondary" : "ghost"}
            className="h-8 px-2 text-xs"
            aria-pressed={selected}
            onClick={() => setPeriod(range.from, range.to)}
          >
            {label}
          </Button>
        );
      })}
    </fieldset>
  );
}
