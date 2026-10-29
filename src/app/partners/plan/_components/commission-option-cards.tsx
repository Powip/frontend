"use client";

import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CommissionOptionDetail } from "@/features/partners/models/commission-option-detail";

interface CommissionOptionCardsProps {
  options: CommissionOptionDetail[] | undefined;
  isLoading: boolean;
  currentOptionCode: string | undefined;
  selectedCode: string;
  onSelectedCodeChange: (code: string) => void;
}

export function CommissionOptionCards({
  options,
  isLoading,
  currentOptionCode,
  selectedCode,
  onSelectedCodeChange,
}: CommissionOptionCardsProps) {
  if (isLoading || !options) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <RadioGroup
      value={selectedCode}
      onValueChange={onSelectedCodeChange}
      className="grid gap-4 sm:grid-cols-3"
    >
      {options.map((option) => {
        const isSelected = option.code === selectedCode;
        const isCurrent = option.code === currentOptionCode;

        return (
          <label
            key={option.code}
            htmlFor={`commission-option-${option.code}`}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-card p-5 transition-colors",
              isSelected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40",
            )}
          >
            <RadioGroupItem
              id={`commission-option-${option.code}`}
              value={option.code}
              className="absolute top-4 right-4"
            />

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                Opción {option.code}
              </span>
              {isCurrent && <Badge variant="secondary">Vigente</Badge>}
            </div>

            <div className="text-2xl font-extrabold text-foreground">
              {option.firstMonthPct}%
              <span className="text-sm font-medium text-muted-foreground"> 1er mes</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {option.recurringPct}%
              <span className="text-sm font-medium text-muted-foreground"> recurrente</span>
            </div>

            <p className="mt-1 text-sm font-semibold text-foreground">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </label>
        );
      })}
    </RadioGroup>
  );
}
