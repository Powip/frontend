"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CeldaDrillProps {
  children: ReactNode;
  onSelect: () => void;
  ariaLabel: string;
  className?: string;
}

export function CeldaDrill({ children, onSelect, ariaLabel, className }: CeldaDrillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-[220px] items-center gap-1.5 truncate rounded text-left font-medium text-pc-text outline-none hover:text-pc-primary hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary",
        className,
      )}
    >
      {children}
      <span aria-hidden className="font-bold text-pc-primary">
        ›
      </span>
    </button>
  );
}

export function PuntoColor({ color }: { color: string }) {
  return (
    <i
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[3px]"
      style={{ background: color }}
    />
  );
}
