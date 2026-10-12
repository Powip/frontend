import type { ComponentProps } from "react";
import { waLabel } from "@/components/whatsapp/ui/wa-classes";
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
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)} {...fieldsetProps}>
      <legend className={cn(waLabel, "mb-1.5 p-0")}>{legend}</legend>
      <div className="flex w-full flex-wrap gap-[3px] rounded-[10px] border border-wa-border bg-wa-surface-2 p-[3px]">
        {options.map((option) => {
          const checked = option.value === value;
          const disabled = readOnly || option.disabled;
          return (
            <label
              key={option.value}
              className={cn(
                "relative inline-flex cursor-pointer items-center rounded-[7px] px-3 py-1.5 text-[13px] font-medium text-wa-muted transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wa-primary",
                checked && "bg-wa-surface text-wa-fg shadow-wa",
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
