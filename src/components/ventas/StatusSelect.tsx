"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatus } from "@/interfaces/IOrder";
import { getStatusPillClasses } from "@/utils/domain/orders-status-flow";
import { cn } from "@/lib/utils";

interface StatusSelectExtraAction {
  value: string;
  label: string;
}

interface StatusSelectProps {
  status: OrderStatus;
  options: OrderStatus[];
  extraAction?: StatusSelectExtraAction;
  onStatusChange: (status: OrderStatus) => void;
  onExtraAction?: (value: string) => void;
}

/**
 * Select de estado mostrado como píldora de color (según getStatusPillClasses),
 * en lugar de un <select> nativo, para que se vea consistente con los badges
 * del resto del panel.
 */
export function StatusSelect({
  status,
  options,
  extraAction,
  onStatusChange,
  onExtraAction,
}: StatusSelectProps) {
  const handleValueChange = (value: string) => {
    if (extraAction && value === extraAction.value) {
      onExtraAction?.(value);
    } else if (value !== status) {
      onStatusChange(value as OrderStatus);
    }
  };

  return (
    <Select value={status} onValueChange={handleValueChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-5 2xl:h-7 w-full max-w-full min-w-0 gap-0 2xl:gap-1 rounded-full border px-1 2xl:px-2.5 py-0 text-[9px] 2xl:text-xs leading-none font-medium shadow-none hover:opacity-80 transition-opacity [&_svg]:opacity-60 [&_svg]:shrink-0 [&_svg]:size-3 2xl:[&_svg]:size-4",
          getStatusPillClasses(status),
        )}
      >
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
        {extraAction && (
          <>
            <SelectSeparator />
            <SelectItem value={extraAction.value}>
              {extraAction.label}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
