"use client";

import { DataOriginBadge } from "@/components/panel-control/DataOriginBadge";
import { InfoTip } from "@/components/panel-control/InfoTip";
import { Skeleton } from "@/components/ui/skeleton";
import { UMBRAL_PERIODO_ABIERTO } from "@/features/panel-control/estado-periodo/models/estado-periodo.model";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatDayKeyWithYear,
  formatPercent,
  formatRange,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";

export function PeriodStatusLine() {
  const { view, dispatch } = usePanel();
  const query = view.access === "permitido" ? view.query : null;
  const estado = usePanelContract("estado-periodo", query);
  if (view.access !== "permitido") return null;
  const { period } = view;
  const actual = estado.data?.actual;
  const abierto = actual?.porcentajeAbierto ?? null;
  const alto = abierto !== null && abierto > UMBRAL_PERIODO_ABIERTO;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-pc-text-muted"
      aria-live="polite"
    >
      <span>
        <span className="font-medium text-pc-text">{formatRange(period.desde, period.hasta)}</span>
        {" · comparado con "}
        {formatRange(period.anteriorDesde, period.anteriorHasta)} a la misma antigüedad
        <span className="sr-only"> ({formatDayKeyWithYear(period.hasta)}, hora Lima)</span>
      </span>
      <InfoTip termino="comparacion" />
      {estado.status === "cargando" && <Skeleton className="h-5 w-40" />}
      {estado.status === "pendiente" && (
        <span className="inline-flex items-center gap-1.5">
          Periodo abierto: <DataOriginBadge origin={estado.origin} />
        </span>
      )}
      {estado.status === "error" && (
        <button type="button" className="text-pc-bad underline" onClick={estado.refetch}>
          No se pudo cargar el estado del periodo · reintentar
        </button>
      )}
      {actual && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 font-semibold",
              alto ? "bg-pc-warn-soft text-pc-warn" : "bg-pc-ok-soft text-pc-ok",
            )}
          >
            {formatPercent(abierto)} del periodo aún abierto
          </span>
          <InfoTip termino="periodo_abierto" />
          <DataOriginBadge origin={estado.origin} />
        </span>
      )}
      <span className="grow" />
      {actual?.calidad && (
        <button
          type="button"
          onClick={() => dispatch({ type: "navigate", tab: "configuracion", subtab: "cuadres" })}
          className="rounded font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          Datos {formatPercent(actual.calidad.datosCompletos)} completos ·{" "}
          {actual.calidad.cuadresOk}/{actual.calidad.cuadresTotal} cuadres ✓
          {estado.origin.kind === "demo" && (
            <span className="ml-1 font-normal text-pc-demo">(demo)</span>
          )}
        </button>
      )}
    </div>
  );
}
