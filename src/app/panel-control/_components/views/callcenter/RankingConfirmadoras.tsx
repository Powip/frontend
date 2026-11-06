"use client";

import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { GoalIndicator } from "@/components/panel-control/GoalIndicator";
import type { ConfirmadoraRankingFila } from "@/features/panel-control/call-center/models/call-center.model";
import type { GrupoDetalleTipo } from "@/features/panel-control/detalle/models/detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { SIN_ASESOR } from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock } from "../ventas/ContractBlock";

export function RankingConfirmadoras({ state }: { state: PanelContractState<"callcenter"> }) {
  const { openDrilldown } = usePanel();
  const abrir = (
    fila: ConfirmadoraRankingFila,
    tipo: GrupoDetalleTipo,
    titulo: string,
    extra: Record<string, string> = {},
  ) =>
    openDrilldown(
      grupos.de(tipo, `${fila.asesorNombre} · ${titulo}`, {
        asesor: fila.asesorId ?? SIN_ASESOR,
        ...extra,
      }),
    );

  return (
    <ContractBlock
      state={state}
      titulo="Ranking de confirmadoras"
      subtitulo="«Entrega de lo confirmado» mide la calidad sobre los leads que confirmó cada persona: confirmar mucho no sirve si luego se rechaza."
    >
      {(data, origin) => {
        const metaConfirmacion = data.metas?.indicadores.confirmacion;
        const columnas: DataTableColumn<ConfirmadoraRankingFila>[] = [
          {
            id: "confirmadora",
            header: "Confirmadora",
            align: "left",
            cell: (fila) => (
              <CeldaDrill
                ariaLabel={`Ver leads asignados a ${fila.asesorNombre}`}
                onSelect={() => abrir(fila, "leads", "leads asignados")}
              >
                {fila.asesorNombre}
              </CeldaDrill>
            ),
            sortValue: (fila) => fila.asesorNombre,
            exportValue: (fila) => fila.asesorNombre,
          },
          {
            id: "asignados",
            header: "Asignados",
            cell: (fila) => formatNumber(fila.asignados),
            sortValue: (fila) => fila.asignados,
            exportValue: (fila) => fila.asignados,
            exportFormat: "numero",
          },
          {
            id: "contactados",
            header: "Contactados",
            cell: (fila) => formatPercent(fila.contactacion),
            sortValue: (fila) => fila.contactacion,
            exportValue: (fila) => fila.contactacion,
            exportFormat: "porcentaje",
          },
          {
            id: "confirmados",
            header: "Confirmados",
            cell: (fila) => (
              <button
                type="button"
                onClick={() => abrir(fila, "leads_confirmados", "confirmados")}
                aria-label={`Ver ${formatNumber(fila.confirmados)} leads confirmados por ${fila.asesorNombre}`}
                className="rounded font-semibold text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                {formatNumber(fila.confirmados)}
              </button>
            ),
            sortValue: (fila) => fila.confirmados,
            exportValue: (fila) => fila.confirmados,
            exportFormat: "numero",
          },
          {
            id: "confirmacion",
            header: "% confirmación",
            cell: (fila) => (
              <span className="inline-flex items-center gap-1.5">
                {metaConfirmacion && (
                  <GoalIndicator
                    compacto
                    evaluacion={evaluarMeta(fila.confirmacion, metaConfirmacion)}
                    demo={origin.kind === "demo"}
                  />
                )}
                {formatPercent(fila.confirmacion)}
              </span>
            ),
            sortValue: (fila) => fila.confirmacion,
            exportValue: (fila) => fila.confirmacion,
            exportFormat: "porcentaje",
          },
          {
            id: "primera",
            header: "1ª llamada",
            cell: (fila) => formatMinutes(fila.tiempoPrimeraLlamadaMin),
            sortValue: (fila) => fila.tiempoPrimeraLlamadaMin,
            exportValue: (fila) => fila.tiempoPrimeraLlamadaMin,
            exportFormat: "numero",
          },
          {
            id: "upsell",
            header: "Upsell",
            cell: (fila) => formatPercent(fila.upsellTasa),
            sortValue: (fila) => fila.upsellTasa,
            exportValue: (fila) => fila.upsellTasa,
            exportFormat: "porcentaje",
          },
          {
            id: "upsell_monto",
            header: "Upsell S/",
            cell: (fila) => formatSoles(fila.upsellMonto),
            sortValue: (fila) => fila.upsellMonto,
            exportValue: (fila) => fila.upsellMonto,
            exportFormat: "soles",
          },
          {
            id: "entrega",
            header: "Entrega de lo confirmado",
            cell: (fila) => (
              <button
                type="button"
                onClick={() =>
                  abrir(fila, "entregados", "entregados de lo confirmado", { entrada: "lead" })
                }
                aria-label={`${fila.asesorNombre}: ${formatPercent(fila.entregaDeLoConfirmado)} de entrega, ${formatNumber(fila.entregadosDeConfirmados)} entregados y ${formatNumber(fila.rechazadosDeConfirmados)} rechazados de sus confirmados. Ver entregados`}
                className="rounded font-semibold text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                {formatPercent(fila.entregaDeLoConfirmado)}
              </button>
            ),
            sortValue: (fila) => fila.entregaDeLoConfirmado,
            exportValue: (fila) => fila.entregaDeLoConfirmado,
            exportFormat: "porcentaje",
          },
          {
            id: "anulados",
            header: "Anulados",
            cell: (fila) => (
              <button
                type="button"
                onClick={() => abrir(fila, "leads_anulados", "anulados")}
                aria-label={`Ver ${formatNumber(fila.anulados)} leads anulados de ${fila.asesorNombre}`}
                className="rounded text-pc-bad underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                {formatNumber(fila.anulados)}
              </button>
            ),
            sortValue: (fila) => fila.anulados,
            exportValue: (fila) => fila.anulados,
            exportFormat: "numero",
          },
          {
            id: "meta",
            header: "Meta confirmados",
            cell: (fila) => formatNumber(fila.metaPeriodo),
            sortValue: (fila) => fila.metaPeriodo,
            exportValue: (fila) => fila.metaPeriodo,
            exportFormat: "numero",
          },
          {
            id: "avance",
            header: "Avance",
            cell: (fila) =>
              formatPercent(fila.metaPeriodo ? fila.confirmados / fila.metaPeriodo : null),
            sortValue: (fila) => (fila.metaPeriodo ? fila.confirmados / fila.metaPeriodo : null),
            exportValue: (fila) => (fila.metaPeriodo ? fila.confirmados / fila.metaPeriodo : null),
            exportFormat: "porcentaje",
          },
        ];
        const k = data.actual.kpis;
        return (
          <DataTable
            caption="Ranking de confirmadoras"
            columns={columnas}
            rows={data.actual.ranking}
            getRowKey={(fila) => fila.asesorId ?? SIN_ASESOR}
            exportar={{
              titulo: "Ranking de confirmadoras",
              nombreBase: "ranking_confirmadoras",
              origen: origin.kind,
            }}
            emptyMessage="Sin leads en el periodo"
            footer={{
              confirmadora: "Total",
              asignados: formatNumber(k.leadsRecibidos),
              contactados: formatPercent(k.contactacion),
              confirmados: formatNumber(k.confirmados),
              confirmacion: formatPercent(k.confirmacion),
              primera: formatMinutes(k.tiempoPrimeraLlamadaMin),
              upsell: formatPercent(k.upsellTasa),
              upsell_monto: formatSoles(k.upsellMonto),
              anulados: formatNumber(k.anulados),
            }}
          />
        );
      }}
    </ContractBlock>
  );
}
