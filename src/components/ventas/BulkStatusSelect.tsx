import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatus } from "@/interfaces/IOrder";
import { getStatusDotClass, getStatusLabel } from "@/utils/domain/orders-status-flow";
import { Layers } from "lucide-react";

export interface BulkExtraAction {
  value: string;
  label: string;
  colorClassName?: string;
}

interface BulkStatusSelectProps {
  selectedCount: number;
  onStatusChange: (status: OrderStatus) => void;
  availableStatuses: OrderStatus[];
  disabled?: boolean;
  isLoading?: boolean;
  extraActions?: BulkExtraAction[];
  onExtraAction?: (actionValue: string) => void;
}

export function BulkStatusSelect({
  selectedCount,
  onStatusChange,
  availableStatuses,
  disabled = false,
  isLoading = false,
  extraActions,
  onExtraAction,
}: BulkStatusSelectProps) {
  const hasActions =
    availableStatuses.length > 0 ||
    (extraActions !== undefined && extraActions.length > 0);

  const isSelectDisabled =
    disabled || isLoading || selectedCount === 0 || !hasActions;

  const handleValueChange = (value: string) => {
    const isExtra = extraActions?.some((a) => a.value === value);
    if (isExtra && onExtraAction) {
      onExtraAction(value);
    } else {
      onStatusChange(value as OrderStatus);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={handleValueChange} disabled={isSelectDisabled}>
        <SelectTrigger
          size="sm"
          className={cn(
            "w-[230px] font-semibold transition-colors",
            isSelectDisabled
              ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
              : "border-violet-600 bg-violet-600 text-white data-[placeholder]:text-white shadow-sm hover:bg-violet-700 dark:border-violet-500 dark:bg-violet-500 dark:hover:bg-violet-600",
          )}
        >
          <Layers className="h-4 w-4 mr-2 text-white placeholder:text-white" />
          <SelectValue
            placeholder={
              isLoading
                ? "Actualizando..."
                : `Cambiar estado ${selectedCount > 0 ? `(${selectedCount})` : ""}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {availableStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    getStatusDotClass(status),
                  )}
                />
                {getStatusLabel(status)}
              </span>
            </SelectItem>
          ))}
          {extraActions && extraActions.length > 0 && (
            <>
              {availableStatuses.length > 0 && <SelectSeparator />}
              {extraActions.map((action) => (
                <SelectItem
                  key={action.value}
                  value={action.value}
                  className={action.colorClassName}
                >
                  {action.label}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
