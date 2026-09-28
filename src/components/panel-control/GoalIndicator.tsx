"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  EvaluacionMeta,
  MetaIndicador,
  SemaforoEstado,
} from "@/features/panel-control/shared/models/goal.model";
import {
  formatNumber,
  formatPercent,
  formatVeces,
} from "@/features/panel-control/shared/utils/format";
import { SEMAFORO_ETIQUETA } from "@/features/panel-control/shared/utils/semaforo";
import { cn } from "@/lib/utils";

const DOT: Record<SemaforoEstado, string> = {
  cumple: "bg-pc-ok",
  cerca: "bg-pc-warn",
  bajo: "bg-pc-bad",
  sin_datos: "bg-pc-border",
};

export function formatMetaValor(meta: MetaIndicador): string {
  switch (meta.unidad) {
    case "porcentaje":
      return formatPercent(meta.valor);
    case "minutos":
      return `${formatNumber(meta.valor)} min`;
    case "dias":
      return `${formatNumber(meta.valor)} d`;
    case "veces":
      return formatVeces(meta.valor);
    default:
      return formatNumber(meta.valor);
  }
}

interface GoalIndicatorProps {
  evaluacion: EvaluacionMeta;
  compacto?: boolean;
  demo?: boolean;
}

export function GoalIndicator({ evaluacion, compacto = false, demo = false }: GoalIndicatorProps) {
  const { estado, meta } = evaluacion;
  const textoMeta = `Meta ${meta.direccion === "minimo" ? "≥" : "≤"} ${formatMetaValor(meta)}${demo ? " (meta por defecto, demo)" : ""}`;
  const etiqueta =
    estado === "sin_datos" ? "Sin datos" : `${SEMAFORO_ETIQUETA[estado]} · ${textoMeta}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex cursor-help items-center gap-1.5 rounded text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-pc-primary",
            estado === "bajo" ? "text-pc-bad" : "text-pc-text-muted",
          )}
        >
          <i aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", DOT[estado])} />
          {!compacto && (estado === "sin_datos" ? "Sin datos" : textoMeta)}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{etiqueta}</TooltipContent>
    </Tooltip>
  );
}
