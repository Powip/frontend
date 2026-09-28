"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  compactLabel?: boolean;
  className?: string;
  hint?: string;
}

export function FilterSelect({
  label,
  value,
  onChange,
  children,
  disabled,
  compactLabel = true,
  className,
  hint,
}: FilterSelectProps) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-lg border border-pc-border bg-pc-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-pc-primary",
        disabled && "opacity-70",
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-pc-text-soft",
          compactLabel && "sr-only min-[1640px]:not-sr-only",
        )}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        title={hint}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 max-w-[170px] cursor-pointer truncate bg-transparent text-xs font-medium text-pc-text outline-none disabled:cursor-not-allowed"
      >
        {children}
      </select>
    </div>
  );
}
