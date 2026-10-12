import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface WaChipRadioOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
}

interface WaChipRadioGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: WaChipRadioOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
}

export function WaChipRadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onValueChange,
  className,
}: WaChipRadioGroupProps<T>) {
  return (
    <fieldset
      className={cn("m-0 flex min-w-0 flex-wrap items-center gap-2.5 border-0 p-0", className)}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-wa-border bg-wa-surface px-3 py-[7px] text-[13px] font-medium text-wa-muted transition-colors hover:text-wa-fg has-[:checked]:border-wa-fg has-[:checked]:bg-wa-surface-2 has-[:checked]:text-wa-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wa-primary",
            option.tone === "danger" && "text-wa-red has-[:checked]:text-wa-red",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onValueChange(option.value)}
            className="sr-only"
          />
          {option.icon}
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
