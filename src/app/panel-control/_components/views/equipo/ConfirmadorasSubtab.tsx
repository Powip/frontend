"use client";

import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type { ConfirmadoraEquipoFila } from "@/features/panel-control/equipo/models/equipo.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

type Fila = ConfirmadoraEquipoFila;

function numero(
  id: string,
  header: string,
  valor: (fila: Fila) => number | null,
): DataTableColumn<Fila> {
  return {
    id,
    header,
    cell: (fila) => formatNumber(valor(fila)),
    sortValue: valor,
    exportValue: valor,
    exportFormat: "numero",
  };
}

function porcentaje(
  id: string,
  header: string,
  valor: (fila: Fila) => number | null,
): DataTableColumn<Fila> {
  return {
    id,
    header,
    cell: (fila) => formatPercent(valor(fila)),
    sortValue: valor,
    exportValue: valor,
    exportFormat: "porcentaje",
  };
}

export function ConfirmadorasSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract(
    "equipo-confirmadoras",
    view.access === "permitido" ? view.query : null,
  );

  const columnas: DataTableColumn<Fila>[] = [
    {
      id: "confirmadora",
      header: "Confirmadora",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver leads asignados a ${fila.asesorNombre}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("leads", `${fila.asesorNombre} · leads`, { asesor: fila.asesorId }),
            )
          }
        >
          {fila.asesorNombre}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.asesorNombre,
      exportValue: (fila) => fila.asesorNombre,
    },
    numero("asignados", "Asignados", (fila) => fila.asignados),
    porcentaje("contactados", "Contactados", (fila) => fila.contactacion),
    numero("confirmados", "Confirmados", (fila) => fila.confirmados),
    porcentaje("confirmacion", "% confirmación", (fila) => fila.confirmacion),
    {
      id: "primera",
      header: "1ª llamada",
      cell: (fila) => formatMinutes(fila.tiempoPrimeraLlamadaMin),
      sortValue: (fila) => fila.tiempoPrimeraLlamadaMin,
      exportValue: (fila) => fila.tiempoPrimeraLlamadaMin,
      exportFormat: "numero",
    },
    {
      id: "entregados",
      header: "Entregados",
      cell: (fila) =>
        fila.entregados ? (
          <button
            type="button"
            onClick={() =>
              openDrilldown(
                grupos.de("entregados", `${fila.asesorNombre} · entregados de lo confirmado`, {
                  asesor: fila.asesorId,
                  entrada: "lead",
                }),
              )
            }
            aria-label={`Ver ${formatNumber(fila.entregados)} entregados confirmados por ${fila.asesorNombre}`}
            className="rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            {formatNumber(fila.entregados)}
          </button>
        ) : (
          "0"
        ),
      sortValue: (fila) => fila.entregados,
      exportValue: (fila) => fila.entregados,
      exportFormat: "numero",
    },
    porcentaje("entrega", "% entrega", (fila) => fila.efectividadEntrega),
    numero("anulados", "Anulados", (fila) => fila.anulados),
    porcentaje("upsell", "Upsell", (fila) => fila.upsellTasa),
    {
      id: "upsell_pagado",
      header: "Upsell pagado",
      cell: (fila) => formatSoles(fila.upsellPagado),
      sortValue: (fila) => fila.upsellPagado,
      exportValue: (fila) => fila.upsellPagado,
      exportFormat: "soles",
    },
    numero("meta", "Meta de confirmados", (fila) => fila.metaPeriodo),
    porcentaje("avance", "Avance", (fila) => fila.avanceMeta),
    {
      id: "comision",
      header: "Comisión*",
      capability: "ver_comisiones",
      cell: (fila) => formatSoles(fila.comisionEstimada ?? null),
      sortValue: (fila) => fila.comisionEstimada ?? null,
      exportValue: (fila) => fila.comisionEstimada ?? null,
      exportFormat: "soles",
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={["Asignados", "Por confirmar", "Confirmados", "Entrega de lo confirmado", "Upsell"]}
        titulo="Indicadores de confirmadoras"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          const metas = data.metas?.indicadores;
          return [
            <KpiCard
              key="asignados"
              label="Asignados"
              glosario="lead"
              value={formatNumber(k.asignados)}
              origin={origin}
              delta={a ? calcularDelta(k.asignados, a.asignados) : undefined}
              onDrill={() => openDrilldown(grupos.de("leads", "Leads asignados"))}
            />,
            <KpiCard
              key="por_confirmar"
              label="Por confirmar"
              value={formatNumber(k.porConfirmar)}
              origin={origin}
              sub="Leads del periodo aún en PENDIENTE"
              onDrill={() => openDrilldown(grupos.leadsAbiertos())}
            />,
            <KpiCard
              key="confirmados"
              label="Confirmados"
              glosario="confirmacion"
              value={formatPercent(k.confirmacion)}
              origin={origin}
              delta={a ? calcularDelta(k.confirmacion, a.confirmacion) : undefined}
              meta={metas ? evaluarMeta(k.confirmacion, metas.confirmacion) : undefined}
              metaDemo={origin.kind === "demo"}
              sub={`${formatNumber(k.confirmados)} confirmados`}
              onDrill={() => openDrilldown(grupos.de("leads_confirmados", "Leads confirmados"))}
            />,
            <KpiCard
              key="entrega"
              label="Entrega de lo confirmado"
              glosario="efectividad_entrega"
              value={formatPercent(k.efectividadEntrega)}
              origin={origin}
              meta={
                metas ? evaluarMeta(k.efectividadEntrega, metas.efectividad_entrega) : undefined
              }
              metaDemo={origin.kind === "demo"}
              onDrill={() =>
                openDrilldown(
                  grupos.de("entregados", "Entregados de leads confirmados", { entrada: "lead" }),
                )
              }
            />,
            <KpiCard
              key="upsell"
              label="Upsell"
              glosario="upsell"
              value={formatPercent(k.upsellTasa)}
              origin={origin}
              sub={`${formatSoles(k.upsellMonto)} adicionales`}
              onDrill={() =>
                openDrilldown(
                  grupos.de("con_upsell", "Confirmados con upsell", { entrada: "lead" }),
                )
              }
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Confirmadoras"
        subtitulo="Mismo cálculo que el ranking de Call center. Entregados y % de entrega son de los leads que confirmó cada una."
      >
        {(data, origin) => (
          <div className="space-y-2">
            <DataTable
              caption="Confirmadoras"
              columns={columnas}
              rows={data.actual.filas}
              getRowKey={(fila) => fila.asesorId}
              exportar={{
                titulo: "Confirmadoras",
                nombreBase: "confirmadoras",
                origen: origin.kind,
              }}
              footer={{
                confirmadora: "Total",
                asignados: formatNumber(data.actual.total.asignados),
                contactados: formatPercent(data.actual.total.contactacion),
                confirmados: formatNumber(data.actual.total.confirmados),
                confirmacion: formatPercent(data.actual.total.confirmacion),
                primera: formatMinutes(data.actual.total.tiempoPrimeraLlamadaMin),
                entregados: formatNumber(data.actual.total.entregados),
                entrega: formatPercent(data.actual.total.efectividadEntrega),
                anulados: formatNumber(data.actual.total.anulados),
                upsell: formatPercent(data.actual.total.upsellTasa),
                upsell_pagado: formatSoles(data.actual.total.upsellPagado),
                meta: formatNumber(data.actual.total.metaPeriodo),
                avance: formatPercent(data.actual.total.avanceMeta),
                comision: formatSoles(data.actual.total.comisionEstimada ?? null),
              }}
            />
            {data.actual.reglaComision && (
              <p className="text-xs text-pc-text-muted">
                * Comisión de ejemplo (configurable):{" "}
                {formatSoles(data.actual.reglaComision.porEntrega)} por confirmado entregado +{" "}
                {formatPercent(data.actual.reglaComision.porcentajeUpsell)} del upsell pagado.
              </p>
            )}
          </div>
        )}
      </ContractBlock>
    </div>
  );
}
