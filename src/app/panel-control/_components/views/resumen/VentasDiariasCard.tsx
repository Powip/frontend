"use client";

import { BarChart } from "@/components/panel-control/charts/BarChart";
import type { ResumenPanel } from "@/features/panel-control/resumen/models/resumen.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import {
  formatDayKey,
  formatNumber,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { ResumenBlock, type ResumenEnvelope, type ResumenState } from "./ResumenBlock";

export function motivoSinComparacion(data: ResumenEnvelope): string | null {
  const dias = data.actual.ventasDiarias;
  if (data.anterior_misma_antiguedad === null) {
    return "Sin línea de comparación: la fuente no entrega el periodo anterior a la misma antigüedad.";
  }
  if (dias.length < 2) {
    return "Sin línea de comparación: el periodo tiene un solo día. La variación aparece en la tarjeta Vendí.";
  }
  if (!dias.some((dia) => dia.facturacionAnterior !== null)) {
    return "Sin línea de comparación: no hay días equivalentes en el periodo anterior.";
  }
  return null;
}

function descripcion(dia: ResumenPanel["ventasDiarias"][number], conComparacion: boolean): string {
  const base = `${formatDayKey(dia.dia)}: ${formatSoles(dia.facturacion)} · ${formatNumber(dia.ventas)} ventas`;
  if (!conComparacion || dia.diaAnterior === null) return base;
  return `${base} · periodo anterior (${formatDayKey(dia.diaAnterior)}): ${formatSoles(dia.facturacionAnterior)}`;
}

export function VentasDiariasCard({ state }: { state: ResumenState }) {
  const { openDrilldown } = usePanel();
  return (
    <ResumenBlock
      state={state}
      titulo="Ventas diarias"
      subtitulo="Facturación por fecha de ingreso (hora Lima). Clic o Enter en una barra abre los pedidos de ese día."
    >
      {(data) => {
        const dias = data.actual.ventasDiarias;
        const motivo = motivoSinComparacion(data);
        const conComparacion = motivo === null;
        const total = dias.reduce((suma, dia) => suma + dia.facturacion, 0);
        const ventas = dias.reduce((suma, dia) => suma + dia.ventas, 0);
        return (
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-3 text-xs text-pc-text-muted" aria-label="Leyenda">
              <li className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-sm"
                  style={{ background: "var(--pc-series-1)" }}
                />
                Ventas del periodo
              </li>
              {conComparacion && (
                <li className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden
                    className="inline-block h-0.5 w-4 border-t-2 border-dashed border-pc-text-soft"
                  />
                  Periodo anterior (misma antigüedad)
                </li>
              )}
            </ul>
            <BarChart
              ariaLabel="Ventas diarias del periodo"
              formatAxis={axisSoles}
              height={260}
              width={620}
              data={dias.map((dia) => ({
                key: dia.dia,
                label: dias.length > 2 ? String(Number(dia.dia.slice(8))) : formatDayKey(dia.dia),
                value: dia.facturacion,
                comparison: conComparacion ? dia.facturacionAnterior : null,
                description: descripcion(dia, conComparacion),
                onSelect: () => openDrilldown(grupos.ventasDia(dia.dia)),
              }))}
            />
            <p className="text-xs text-pc-text-muted">
              Total {formatSoles(total)} · {formatNumber(ventas)} ventas
            </p>
            {motivo && (
              <p
                role="note"
                className="rounded-lg bg-pc-surface-muted px-2.5 py-1.5 text-xs text-pc-text-muted"
              >
                {motivo}
              </p>
            )}
          </div>
        );
      }}
    </ResumenBlock>
  );
}
