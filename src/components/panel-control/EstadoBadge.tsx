import { ESTADOS_PANEL_DEFINICION } from "@/features/panel-control/shared/config/estados.config";
import type { EstadoPanel } from "@/features/panel-control/shared/models/estado-pedido.model";
import { cn } from "@/lib/utils";

const TONO = {
  ok: "bg-pc-ok-soft text-pc-ok",
  warn: "bg-pc-warn-soft text-pc-warn",
  bad: "bg-pc-bad-soft text-pc-bad",
  info: "bg-pc-info-soft text-pc-info",
} as const;

export function EstadoBadge({ estado }: { estado: EstadoPanel }) {
  const definicion = ESTADOS_PANEL_DEFINICION[estado];
  return (
    <span
      title={definicion.descripcion}
      className={cn(
        "inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
        TONO[definicion.tono],
      )}
    >
      {definicion.etiqueta}
    </span>
  );
}
