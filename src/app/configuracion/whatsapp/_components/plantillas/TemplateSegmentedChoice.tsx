import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedChoiceOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface TemplateSegmentedChoiceProps<T extends string>
  extends Omit<ComponentProps<"fieldset">, "onChange"> {
  legend: string;
  name: string;
  value: T;
  options: SegmentedChoiceOption<T>[];
  onValueChange: (value: T) => void;
  readOnly?: boolean;
}

export function TemplateSegmentedChoice<T extends string>({
  legend,
  name,
  value,
  options,
  onValueChange,
  readOnly = false,
  className,
  ...fieldsetProps
}: TemplateSegmentedChoiceProps<T>) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)} {...fieldsetProps}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
        {options.map((option) => {
          const checked = option.value === value;
          const disabled = readOnly || option.disabled;
          return (
            <label
              key={option.value}
              className={cn(
                "relative inline-flex min-h-8 cursor-pointer items-center rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                checked && "bg-background text-foreground shadow-sm",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onValueChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
