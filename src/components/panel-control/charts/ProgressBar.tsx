import type { SemaforoEstado } from "@/features/panel-control/shared/models/goal.model";
import { formatPercent } from "@/features/panel-control/shared/utils/format";
import { evaluarAvance } from "@/features/panel-control/shared/utils/semaforo";

const COLOR: Record<SemaforoEstado, string> = {
  cumple: "var(--pc-ok)",
  cerca: "var(--pc-warn)",
  bajo: "var(--pc-bad)",
  sin_datos: "var(--pc-border)",
};

interface ProgressBarProps {
  logrado: number | null;
  meta: number | null;
  etiqueta: string;
}

export function ProgressBar({ logrado, meta, etiqueta }: ProgressBarProps) {
  const estado = evaluarAvance(logrado, meta);
  const avance = logrado !== null && meta ? Math.min(1, logrado / meta) : 0;
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(avance * 100)}
      aria-valuetext={
        meta ? `${formatPercent(logrado !== null ? logrado / meta : null)} de la meta` : "Sin meta"
      }
      className="mt-2 h-2 overflow-hidden rounded-md bg-pc-border-soft"
    >
      <span
        className="block h-full rounded-md"
        style={{ width: `${avance * 100}%`, background: COLOR[estado] }}
      />
    </div>
  );
}
