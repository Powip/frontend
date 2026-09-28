"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <fieldset
      className={cn(
        "m-0 inline-flex min-w-0 flex-wrap gap-0.5 rounded-lg border-0 bg-pc-border-soft p-0.5",
        className,
      )}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium text-pc-text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pc-primary",
              selected && "bg-pc-card font-semibold text-pc-text shadow-sm",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
