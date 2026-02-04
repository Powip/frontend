"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface PeriodSelectorProps {
  onPeriodChange: (fromDate: string, toDate: string) => void;
  className?: string;
}

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  onPeriodChange,
  className,
}) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Generate last 24 months for quick selection
  const availableMonths = useMemo(() => {
    const months: { label: string; month: number; year: number }[] = [];
    const current = new Date();

    for (let i = 0; i < 24; i++) {
      const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
      months.push({
        label: `${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`,
        month: date.getMonth(),
        year: date.getFullYear(),
      });
    }
    return months;
  }, []);

  const getDateRange = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    return {
      fromDate: formatDate(firstDay),
      toDate: formatDate(lastDay),
    };
  };

  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    const { fromDate, toDate } = getDateRange(month, year);
    onPeriodChange(fromDate, toDate);
  };

  const handlePrevMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    handleMonthChange(newMonth, newYear);
  };

  const handleNextMonth = () => {
    const now = new Date();
    const isCurrentMonth =
      selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
    if (isCurrentMonth) return; // Don't go beyond current month

    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    handleMonthChange(newMonth, newYear);
  };

  const isCurrentMonth =
    selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Trigger initial period on mount
  React.useEffect(() => {
    const { fromDate, toDate } = getDateRange(selectedMonth, selectedYear);
    onPeriodChange(fromDate, toDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md hover:bg-muted"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select
          value={`${selectedMonth}-${selectedYear}`}
          onValueChange={(v) => {
            const [m, y] = v.split("-").map(Number);
            handleMonthChange(m, y);
          }}
        >
          <SelectTrigger className="h-8 w-[160px] border-none bg-transparent text-sm font-medium">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[200px] overflow-y-auto">
            {availableMonths.map((item) => (
              <SelectItem
                key={`${item.month}-${item.year}`}
                value={`${item.month}-${item.year}`}
                className="text-sm"
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md hover:bg-muted"
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isCurrentMonth && (
        <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
          Mes Actual
        </span>
      )}
    </div>
  );
};
