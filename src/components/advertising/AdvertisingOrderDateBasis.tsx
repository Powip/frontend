"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdvertisingOrderBasis } from "@/services/advertisingOrdersService";
import { ORDER_BASIS_LABELS } from "./advertising-orders-model";

export function AdvertisingOrderDateBasis({
  value,
  onChange,
}: {
  value: AdvertisingOrderBasis;
  onChange: (value: AdvertisingOrderBasis) => void;
}) {
  const id = useId();
  return (
    <div className="w-full sm:w-56">
      <Label htmlFor={id}>Fecha del pedido</Label>
      <Select value={value} onValueChange={(next: AdvertisingOrderBasis) => onChange(next)}>
        <SelectTrigger id={id} className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ORDER_BASIS_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
