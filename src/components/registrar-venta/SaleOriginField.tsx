"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SaleStore } from "@/services/saleContextService";

interface Props {
  label: "Tienda de la venta" | "Almacén de salida";
  options: SaleStore[];
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}

export function SaleOriginField({
  label,
  options,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  loading = false,
  hint,
}: Props) {
  const id = useId();
  const isStore = label === "Tienda de la venta";
  const name = options.find((option) => option.id === value)?.name;
  const placeholder = loading
    ? "Cargando…"
    : isStore
      ? "Selecciona una tienda"
      : "Selecciona un almacén";
  const text = name ?? (isStore ? "Tienda registrada" : "Almacén registrado");

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label} {!readOnly && <span className="text-destructive">*</span>}
      </Label>
      {readOnly || (options.length === 1 && value === options[0].id) ? (
        <Input
          id={id}
          readOnly
          value={value ? text : isStore ? "Tienda no registrada" : "Almacén no registrado"}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="bg-muted/30"
        />
      ) : (
        <Select value={value} onValueChange={onChange} disabled={disabled || loading || !options.length}>
          <SelectTrigger
            id={id}
            aria-required="true"
            aria-describedby={hint ? `${id}-hint` : undefined}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
