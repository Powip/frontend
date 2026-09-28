"use client";

import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { PanelCard } from "@/components/panel-control/PanelCard";
import type { CallCenterPanel } from "@/features/panel-control/call-center/models/call-center.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { ContractResult } from "@/features/panel-control/shared/data/panel-contract-map";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import type { MetaIndicadorId } from "@/features/panel-control/shared/models/goal.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatSoles,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { KpiRow } from "../ventas/ContractBlock";

type CallCenterState = PanelContractState<"callcenter">;
type CallCenterEnvelope = ContractResult<"callcenter">;

export const KPI_CALLCENTER = [
  "Leads recibidos",
  "Por llamar ahora",
  "Tiempo a 1ª llamada",
  "Contactados",
  "Confirmados",
  "Upsell",
];

function metaDe(data: CallCenterEnvelope, id: MetaIndicadorId, valor: number | null) {
  return data.metas ? evaluarMeta(valor, data.metas.indicadores[id]) : undefined;
}

export function MiDiaCard({
  miDia,
  origin,
}: {
  miDia: NonNullable<CallCenterPanel["miDia"]>;
  origin: DataOrigin;
}) {
  const { openDrilldown } = usePanel();
  return (
    <PanelCard
      titulo={`Mi día · ${miDia.asesorNombre}`}
      subtitulo={
        miDia.puesto
          ? `Puesto ${miDia.puesto} de ${miDia.totalConfirmadoras} en confirmación del equipo. Todo lo que ves está filtrado a ti.`
          : "Todavía no tienes leads cerrados en el periodo. Todo lo que ves está filtrado a ti."
      }
      origin={origin}
      className="border-pc-primary"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Mi cola ahora"
          value={formatNumber(miDia.miCola)}
          sub="Leads asignados a mí por llamar (estado actual)"
          onDrill={() =>
            openDrilldown(grupos.actual("cola_leads", "Mi cola de leads", {}, "llamar"))
          }
          drillLabel="Llamar ahora"
        />
        <KpiCard
          label="Mi confirmación"
          glosario="confirmacion"
          value={formatPercent(miDia.miConfirmacion)}
          sub={`Equipo: ${formatPercent(miDia.confirmacionEquipo)}`}
          onDrill={() => openDrilldown(grupos.de("leads_confirmados", "Mis leads confirmados"))}
          drillLabel="Ver confirmados"
        />
        <KpiCard
          label="Mis confirmados vs meta"
          value={`${formatNumber(miDia.confirmados)} / ${miDia.metaPeriodo === null ? SIN_DATO : formatNumber(miDia.metaPeriodo)}`}
          sub={
            <ProgressBar
              logrado={miDia.confirmados}
              meta={miDia.metaPeriodo}
              etiqueta="Avance de mis confirmados sobre la meta del periodo"
            />
          }
        />
        <KpiCard
          label="Mi upsell"
          glosario="upsell"
          value={formatSoles(miDia.upsellMonto)}
          sub={`${formatPercent(miDia.upsellTasa)} de mis confirmados · equipo ${formatPercent(miDia.upsellTasaEquipo)}`}
          onDrill={() =>
            openDrilldown(
              grupos.de("con_upsell", "Mis confirmados con upsell", { entrada: "lead" }),
            )
          }
        />
      </div>
    </PanelCard>
  );
}

export function CallCenterKpis({ state }: { state: CallCenterState }) {
  const { openDrilldown } = usePanel();
  return (
    <KpiRow
      state={state}
      labels={KPI_CALLCENTER}
      titulo="Indicadores de call center"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
    >
      {(data, origin) => {
        const k = data.actual.kpis;
        const a = data.anterior_misma_antiguedad?.kpis;
        const metaDemo = origin.kind === "demo";
        return [
          <KpiCard
            key="leads"
            label="Leads recibidos"
            glosario="lead"
            value={formatNumber(k.leadsRecibidos)}
            origin={origin}
            delta={a ? calcularDelta(k.leadsRecibidos, a.leadsRecibidos) : undefined}
            sub={`${formatSoles(k.valorLeads)} en valor · ${formatNumber(k.abiertos)} aún sin cerrar`}
            onDrill={() => openDrilldown(grupos.de("leads", "Leads recibidos"))}
            drillLabel="Ver leads"
          />,
          <KpiCard
            key="cola"
            label="Por llamar ahora"
            value={formatNumber(k.porLlamarAhora)}
            origin={origin}
            sub={`${formatNumber(k.sinIntentoAhora)} sin ningún intento · estado actual`}
            onDrill={() =>
              openDrilldown(grupos.actual("cola_leads", "Leads por llamar ahora", {}, "llamar"))
            }
            drillLabel="Llamar ahora"
          />,
          <KpiCard
            key="primera"
            label="Tiempo a 1ª llamada"
            glosario="tiempo_primera_llamada"
            value={formatMinutes(k.tiempoPrimeraLlamadaMin)}
            origin={origin}
            delta={
              a
                ? calcularDelta(
                    k.tiempoPrimeraLlamadaMin,
                    a.tiempoPrimeraLlamadaMin,
                    "menos_es_mejor",
                  )
                : undefined
            }
            meta={metaDe(data, "tiempo_primera_llamada", k.tiempoPrimeraLlamadaMin)}
            metaDemo={metaDemo}
            sub={`Mediana de ${formatNumber(k.leadsConPrimeraLlamada)} leads · ${formatNumber(k.llamadasTardias)} sobre la meta`}
            onDrill={
              k.llamadasTardias > 0
                ? () =>
                    openDrilldown(
                      grupos.de("primera_llamada_tardia", "Leads con 1ª llamada sobre la meta"),
                    )
                : undefined
            }
            drillLabel="Ver los tardíos"
          />,
          <KpiCard
            key="contactados"
            label="Contactados"
            glosario="contactados"
            value={formatPercent(k.contactacion)}
            origin={origin}
            delta={a ? calcularDelta(k.contactacion, a.contactacion) : undefined}
            meta={metaDe(data, "contactados", k.contactacion)}
            metaDemo={metaDemo}
            sub={`${formatNumber(k.contactados)} de ${formatNumber(k.trabajados)} leads ya trabajados`}
            onDrill={() => openDrilldown(grupos.de("contactados", "Leads contactados"))}
          />,
          <KpiCard
            key="confirmados"
            label="Confirmados"
            glosario="confirmacion"
            value={formatPercent(k.confirmacion)}
            origin={origin}
            delta={a ? calcularDelta(k.confirmacion, a.confirmacion) : undefined}
            meta={metaDe(data, "confirmacion", k.confirmacion)}
            metaDemo={metaDemo}
            sub={`${formatNumber(k.confirmados)} confirmados ÷ ${formatNumber(k.confirmados + k.anulados)} cerrados · ${formatNumber(k.abiertos)} pendientes no cuentan`}
            onDrill={() => openDrilldown(grupos.de("leads_confirmados", "Leads confirmados"))}
          />,
          <KpiCard
            key="upsell"
            label="Upsell"
            glosario="upsell"
            value={formatPercent(k.upsellTasa)}
            origin={origin}
            delta={a ? calcularDelta(k.upsellTasa, a.upsellTasa) : undefined}
            meta={metaDe(data, "upsell", k.upsellTasa)}
            metaDemo={metaDemo}
            sub={`${formatSoles(k.upsellMonto)} adicionales · ${formatNumber(k.confirmadosConUpsell)} de ${formatNumber(k.confirmados)} confirmados`}
            onDrill={() =>
              openDrilldown(
                grupos.de("con_upsell", "Leads confirmados con upsell", { entrada: "lead" }),
              )
            }
          />,
        ];
      }}
    </KpiRow>
  );
}
