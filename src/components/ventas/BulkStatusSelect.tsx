import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatus } from "@/interfaces/IOrder";
import { Layers } from "lucide-react";

interface BulkStatusSelectProps {
  selectedCount: number;
  onStatusChange: (status: OrderStatus) => void;
  availableStatuses: OrderStatus[];
  disabled?: boolean;
  isLoading?: boolean;
}

export function BulkStatusSelect({
  selectedCount,
  onStatusChange,
  availableStatuses,
  disabled = false,
  isLoading = false,
}: BulkStatusSelectProps) {
  const isSelectDisabled =
    disabled ||
    isLoading ||
    selectedCount === 0 ||
    availableStatuses.length === 0;

  return (
    <div className="flex items-center gap-2">
      <Select
        onValueChange={(value) => onStatusChange(value as OrderStatus)}
        disabled={isSelectDisabled}
      >
        <SelectTrigger
          className={cn(
            "w-[230px] h-9 transition-colors",
            isSelectDisabled
              ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
          )}
        >
          <Layers className="h-4 w-4 mr-2" />
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
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
