"use client";

import React, { useState, useEffect } from "react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfToday,
  startOfYesterday,
  subMonths,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PeriodSelectorProps {
  onPeriodChange: (fromDate: string, toDate: string) => void;
  className?: string;
}

type Preset = {
  label: string;
  getValue: () => DateRange;
};

const PRESETS: Preset[] = [
  {
    label: "Hoy",
    getValue: () => ({ from: startOfToday(), to: startOfToday() }),
  },
  {
    label: "Ayer",
    getValue: () => ({ from: startOfYesterday(), to: startOfYesterday() }),
  },
  {
    label: "Últimos 7 días",
    getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "Últimos 30 días",
    getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    label: "Mes Actual",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Mes Pasado",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    },
  },
  {
    label: "Este Año",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  onPeriodChange,
  className,
}) => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [activePreset, setActivePreset] = useState<string>("Mes Actual");

  const handlePresetChange = (presetLabel: string) => {
    const preset = PRESETS.find((p) => p.label === presetLabel);
    if (preset) {
      const range = preset.getValue();
      setDate(range);
      setActivePreset(presetLabel);
      if (range.from && range.to) {
        onPeriodChange(
          format(range.from, "yyyy-MM-dd"),
          format(range.to, "yyyy-MM-dd"),
        );
      }
    }
  };

  const handleCustomDateChange = (newDate: DateRange | undefined) => {
    setDate(newDate);
    setActivePreset("Personalizado");
    if (newDate?.from && newDate?.to) {
      onPeriodChange(
        format(newDate.from, "yyyy-MM-dd"),
        format(newDate.to, "yyyy-MM-dd"),
      );
    }
  };

  // Emit initial period on mount
  useEffect(() => {
    if (date?.from && date?.to) {
      onPeriodChange(
        format(date.from, "yyyy-MM-dd"),
        format(date.to, "yyyy-MM-dd"),
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayDate = () => {
    if (!date?.from) return "Seleccionar fechas";
    if (!date.to || isSameDay(date.from, date.to)) {
      return format(date.from, "PPP", { locale: es });
    }
    return `${format(date.from, "dd LLL", { locale: es })} - ${format(
      date.to,
      "dd LLL, yyyy",
      { locale: es },
    )}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal bg-card hover:bg-accent border-muted-foreground/20",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            <span className="truncate">{displayDate()}</span>
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 flex flex-col sm:flex-row"
          align="end"
        >
          <div className="border-r p-2 flex flex-col gap-1 bg-muted/20 sm:w-40">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">
              Presets
            </p>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-between font-normal text-xs h-8 px-2",
                  activePreset === preset.label &&
                    "bg-primary/10 text-primary font-medium hover:bg-primary/20",
                  activePreset !== preset.label && "hover:bg-accent",
                )}
                onClick={() => handlePresetChange(preset.label)}
              >
                {preset.label}
                {activePreset === preset.label && <Check className="h-3 w-3" />}
              </Button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleCustomDateChange}
              numberOfMonths={2}
              locale={es}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
