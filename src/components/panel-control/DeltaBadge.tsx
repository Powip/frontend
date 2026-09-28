"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Delta } from "@/features/panel-control/shared/models/comparison.model";
import { cn } from "@/lib/utils";

const ESTILO = {
  bueno: "bg-pc-ok-soft text-pc-ok",
  malo: "bg-pc-bad-soft text-pc-bad",
  neutro: "bg-pc-border-soft text-pc-text-muted",
  sin_dato: "bg-pc-border-soft text-pc-text-muted",
} as const;

interface DeltaBadgeProps {
  delta: Delta;
  className?: string;
}

export function DeltaBadge({ delta, className }: DeltaBadgeProps) {
  const texto =
    delta.variacion === null
      ? "—"
      : `${delta.variacion > 0 ? "▲" : "▼"} ${Math.abs(delta.variacion * 100).toFixed(0)}%`;
  const descripcion =
    delta.variacion === null
      ? "Sin periodo anterior comparable"
      : `${delta.variacion > 0 ? "Subió" : "Bajó"} ${Math.abs(delta.variacion * 100).toFixed(0)}% vs el periodo anterior a la misma antigüedad`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={descripcion}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex cursor-help items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-pc-primary",
            ESTILO[delta.tono],
            className,
          )}
        >
          {texto}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{descripcion}</TooltipContent>
    </Tooltip>
  );
}
