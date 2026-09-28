"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSARIO, type GlosarioId } from "@/features/panel-control/shared/config/glosario.config";

interface InfoTipProps {
  termino: GlosarioId;
}

export function InfoTip({ termino }: InfoTipProps) {
  const entrada = GLOSARIO[termino];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Qué significa ${entrada.termino}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-grid size-4 shrink-0 place-items-center rounded-full bg-pc-border-soft text-[10px] font-bold normal-case tracking-normal text-pc-text-muted outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <span className="font-semibold">{entrada.termino}: </span>
        {entrada.definicion}
      </TooltipContent>
    </Tooltip>
  );
}
