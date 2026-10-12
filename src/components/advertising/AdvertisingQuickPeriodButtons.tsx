"use client";

import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";

type QuickPeriod = "today" | "yesterday" | "7d" | "30d";
const PERIODS: Array<{ value: QuickPeriod; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

export function advertisingQuickRange(period: QuickPeriod, now = new Date()) {
  const to = period === "yesterday" ? subDays(now, 1) : now;
  const from = period === "7d" ? subDays(to, 6) : period === "30d" ? subDays(to, 29) : to;
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
}

export function AdvertisingQuickPeriodButtons() {
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  return (
    <fieldset
      className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1"
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
            className="h-8 px-3 text-xs"
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
