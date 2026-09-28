"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { cn } from "@/lib/utils";

interface DataOriginBadgeProps {
  origin: DataOrigin;
  mostrarReal?: boolean;
  className?: string;
}

const ESTILOS = {
  demo: "bg-pc-demo-soft text-pc-demo border-pc-demo/30",
  pendiente: "bg-pc-surface-muted text-pc-text-muted border-pc-border",
  real: "bg-pc-ok-soft text-pc-ok border-pc-ok/30",
} as const;

const ETIQUETAS = {
  demo: "Demo",
  pendiente: "Pendiente",
  real: "Real",
} as const;

export function DataOriginBadge({ origin, mostrarReal = false, className }: DataOriginBadgeProps) {
  if (origin.kind === "real" && !mostrarReal) return null;
  const descripcion =
    origin.kind === "demo"
      ? `Datos de demostración. ${origin.detalle}. Contrato: ${origin.endpoint}`
      : origin.kind === "pendiente"
        ? `${origin.detalle}. Contrato: ${origin.endpoint}`
        : `Datos reales · ${origin.endpoint}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${ETIQUETAS[origin.kind]}: ${descripcion}`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex shrink-0 cursor-help items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-pc-primary",
            ESTILOS[origin.kind],
            className,
          )}
        >
          {ETIQUETAS[origin.kind]}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{descripcion}</TooltipContent>
    </Tooltip>
  );
}
