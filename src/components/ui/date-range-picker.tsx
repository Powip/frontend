"use client";

import * as React from "react";
import { addDays, format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
}: DateRangePickerProps) {
  const presets = [
    { label: "Últimos 7 días", value: 7 },
    { label: "Últimos 30 días", value: 30 },
    { label: "Últimos 60 días", value: 60 },
    { label: "Último año", value: 365 },
  ];

  const handlePresetSelect = (days: number) => {
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(to, days));
    onDateChange({ from, to });
  };

  const isPresetActive = (days: number) => {
    if (!date?.from || !date?.to) return false;
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(to, days));
    
    // Check if dates are close enough (within the same day)
    return (
      date.from.toDateString() === from.toDateString() &&
      date.to.toDateString() === to.toDateString()
    );
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: es })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: es })
              )
            ) : (
              <span>Seleccionar rango de fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col md:flex-row shadow-2xl border-primary/20" align="start">
          <div className="flex flex-col gap-1 p-3 border-b md:border-b-0 md:border-r bg-muted/20 min-w-[160px]">
             <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">Rápido</p>
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-between font-medium text-xs hover:bg-primary/10 hover:text-primary transition-colors",
                  isPresetActive(preset.value) && "bg-primary/10 text-primary"
                )}
                onClick={() => handlePresetSelect(preset.value)}
              >
                {preset.label}
                {isPresetActive(preset.value) && <Check className="h-3 w-3" />}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-between font-medium text-xs mt-2 text-muted-foreground",
                !date && "bg-primary/10 text-primary"
              )}
              onClick={() => onDateChange(undefined)}
            >
              Todo el tiempo
            </Button>
          </div>
          <div className="p-1">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={onDateChange}
              numberOfMonths={2}
              locale={es}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
