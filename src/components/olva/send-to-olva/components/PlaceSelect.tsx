"use client";

import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

interface PlaceSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

/** One level (department, province or district) of an Olva place picker. */
export function PlaceSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  isLoading,
}: PlaceSelectProps) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Combobox
        value={value}
        options={options}
        placeholder="Seleccionar"
        searchPlaceholder={`Buscar ${label.toLowerCase()}`}
        disabled={disabled}
        isLoading={isLoading}
        onValueChange={onChange}
      />
    </div>
  );
}

/** Options of a place level, from anything that has a name. */
export const toPlaceOptions = (divisions: readonly { name: string }[] | undefined) =>
  (divisions ?? []).map((division) => ({ value: division.name, label: division.name }));
