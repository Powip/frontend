"use client";

import { VentasDiariasChart } from "@/components/panel-control/charts/VentasDiariasChart";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
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

export function VentasDiariasCard({ state }: { state: ResumenState }) {
  const { openDrilldown } = usePanel();
  return (
    <ResumenBlock
      state={state}
      titulo="Ventas diarias"
      subtitulo="Por fecha de ingreso (hora Lima). Elige la métrica sobre el gráfico; clic o Enter en una barra abre los pedidos de ese día."
    >
      {(data) => {
        const motivo = motivoSinComparacion(data);
        return (
          <div className="space-y-2">
            <VentasDiariasChart
              dias={data.actual.ventasDiarias}
              ariaLabel="Ventas diarias del periodo"
              conComparacion={motivo === null}
              onSelectDia={(dia) => openDrilldown(grupos.ventasDia(dia))}
            />
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
