"use client";

import { LineChart } from "@/components/panel-control/charts/LineChart";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisSoles, seriesColor } from "@/features/panel-control/shared/utils/chart";
import {
  formatDayKey,
  formatRange,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { addDays } from "@/features/panel-control/shared/utils/lima-time";
import { ContractBlock } from "../ContractBlock";

export function TendenciaFamilias({ state }: { state: PanelContractState<"canales-comparativo"> }) {
  const { openDrilldown } = usePanel();
  return (
    <ContractBlock
      state={state}
      titulo="Tendencia semanal por familia"
      subtitulo="Facturación de las últimas 12 semanas (lunes a domingo, hora Lima; no depende del periodo). Las 3 familias principales y el resto en «Otras». Cada punto abre las ventas de esa semana."
      skeleton="linea"
    >
      {(data) => {
        const { tendencia, semanaEnCurso } = data.actual;
        const semanas = tendencia[0]?.valores.map((valor) => valor.semanaDesde) ?? [];
        const otras = tendencia.find((serie) => serie.agrupada);
        return (
          <div className="space-y-2">
            <LineChart
              ariaLabel="Facturación semanal por familia de canal"
              etiquetas={semanas.map((semana) =>
                semana === semanaEnCurso ? `${formatDayKey(semana)}*` : formatDayKey(semana),
              )}
              series={tendencia.map((serie, index) => ({
                id: serie.familia,
                nombre: serie.familia,
                color: seriesColor(index),
                punteada: serie.agrupada,
                valores: serie.valores.map((valor) => valor.facturacion),
              }))}
              formatAxis={axisSoles}
              formatValue={formatSoles}
              height={260}
              width={1000}
              puntos={(linea, indice) => {
                const serie = tendencia.find((item) => item.familia === linea.id);
                const semana = serie?.valores[indice];
                if (!serie || !semana || semana.facturacion <= 0) return null;
                const hasta = addDays(semana.semanaDesde, 6);
                return {
                  accion: "Ver ventas de esa semana",
                  onSelect: () =>
                    openDrilldown(
                      grupos.rango(
                        `${serie.familia} · semana del ${formatRange(semana.semanaDesde, hasta)}`,
                        {
                          desde: semana.semanaDesde,
                          hasta,
                          familias: serie.familiasIncluidas.join(","),
                        },
                      ),
                    ),
                };
              }}
            />
            <p className="text-xs text-pc-text-muted">
              {semanaEnCurso && "* Semana en curso: aún incompleta. "}
              {otras && `«Otras» agrupa: ${otras.familiasIncluidas.join(", ")}.`}
            </p>
          </div>
        );
      }}
    </ContractBlock>
  );
}
