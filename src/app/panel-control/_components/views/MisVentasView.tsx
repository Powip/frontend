"use client";

import { HBarList } from "@/components/panel-control/charts/HBarList";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { EstadoBadge } from "@/components/panel-control/EstadoBadge";
import { KpiCard } from "@/components/panel-control/KpiCard";
import type { DetallePedidoFila } from "@/features/panel-control/detalle/models/detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { ESTADOS_PANEL_DEFINICION } from "@/features/panel-control/shared/config/estados.config";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDayKey,
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { ContractBlock, KpiRow } from "./ventas/ContractBlock";
import { OrigenCanalesNota } from "./ventas/OrigenCanalesNota";

const columnasNoCobrados: DataTableColumn<DetallePedidoFila>[] = [
  {
    id: "pedido",
    header: "Pedido",
    align: "left",
    cell: (fila) => (
      <span className="font-medium">
        {fila.listaNegra && (
          <span role="img" aria-label="Cliente con rechazos previos" className="mr-1 text-pc-bad">
            ⚑
          </span>
        )}
        {fila.numero}
      </span>
    ),
    sortValue: (fila) => fila.numero,
    exportValue: (fila) => fila.numero,
  },
  {
    id: "ingreso",
    header: "Ingreso",
    align: "left",
    cell: (fila) => `${formatDayKey(fila.ingreso.slice(0, 10))} ${fila.ingreso.slice(11, 16)}`,
    sortValue: (fila) => fila.ingreso,
    exportValue: (fila) => fila.ingreso,
  },
  {
    id: "cliente",
    header: "Cliente",
    align: "left",
    cell: (fila) => `${fila.cliente}${fila.departamento ? ` · ${fila.departamento}` : ""}`,
    sortValue: (fila) => fila.cliente,
    exportValue: (fila) => fila.cliente,
  },
  {
    id: "estado",
    header: "Estado",
    align: "left",
    cell: (fila) => (
      <span className="inline-flex items-center gap-1">
        <EstadoBadge estado={fila.estado} />
        {fila.vencido && <span className="text-[10.5px] font-semibold text-pc-bad">vencido</span>}
      </span>
    ),
    sortValue: (fila) => fila.estado,
    exportValue: (fila) => fila.estado,
  },
  {
    id: "neto",
    header: "Neto",
    cell: (fila) => formatSoles(fila.neto),
    sortValue: (fila) => fila.neto,
    exportValue: (fila) => fila.neto,
    exportFormat: "soles",
  },
];

export function MisVentasView() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("mis-ventas", view.access === "permitido" ? view.query : null);

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={["Vendí", "Mi meta del periodo", "Pagado", "Mi comisión estimada"]}
        titulo="Mis ventas"
      >
        {(data, origin) => {
          const d = data.actual;
          const a = data.anterior_misma_antiguedad;
          return [
            <KpiCard
              key="vendi"
              label="Vendí"
              glosario="venta"
              value={formatSoles(d.vendi.facturacion)}
              origin={origin}
              delta={a ? calcularDelta(d.vendi.facturacion, a.vendi.facturacion) : undefined}
              sub={`${formatNumber(d.vendi.ventas)} ventas · ticket ${formatSoles(d.vendi.ticket)}`}
              onDrill={() => openDrilldown(grupos.de("ventas", "Mis ventas"))}
            />,
            <KpiCard
              key="meta"
              label="Mi meta del periodo"
              value={formatPercent(d.meta.avance)}
              origin={origin}
              sub={
                <>
                  <ProgressBar
                    logrado={d.vendi.facturacion}
                    meta={d.meta.metaPeriodo}
                    etiqueta="Avance de mi meta del periodo"
                  />
                  <span className="mt-1 block">
                    Meta {formatSoles(d.meta.metaPeriodo)} · falta {formatSoles(d.meta.falta)}
                  </span>
                </>
              }
            />,
            <KpiCard
              key="pagado"
              label="Pagado"
              glosario="pagado"
              value={formatSoles(d.pagado.pagado)}
              origin={origin}
              sub={`Entrega ${formatPercent(d.pagado.efectividadEntrega)} · perdido ${formatSoles(d.pagado.perdido)}`}
              onDrill={() => openDrilldown(grupos.de("cobrado", "Mis ventas pagadas"))}
            />,
            <KpiCard
              key="comision"
              label="Mi comisión estimada"
              value={d.comisionEstimada ? formatSoles(d.comisionEstimada.monto) : "Pendiente"}
              origin={origin}
              sub={
                d.comisionEstimada
                  ? `${formatPercent(d.comisionEstimada.porcentajePagado)} de lo pagado + ${formatPercent(d.comisionEstimada.porcentajeUpsell)} del upsell`
                  : "Pendiente de decisión: §6.7 la muestra, pero §14 dice que la vendedora no recibe comisiones"
              }
            />,
          ];
        }}
      </KpiRow>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ContractBlock
          state={state}
          titulo="Mis pedidos por estado"
          subtitulo="Pedidos del periodo según su estado actual"
        >
          {(data) => (
            <HBarList
              ariaLabel="Mis pedidos por estado"
              formatValue={formatNumber}
              rows={data.actual.porEstado.map((fila) => ({
                key: fila.estado,
                label: ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta,
                value: fila.pedidos,
                onSelect: () =>
                  openDrilldown(
                    grupos.de(
                      "pedidos",
                      `Mis pedidos · ${ESTADOS_PANEL_DEFINICION[fila.estado].etiqueta}`,
                      {
                        estado: fila.estado,
                      },
                    ),
                  ),
              }))}
            />
          )}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Ranking de vendedoras"
          subtitulo={
            state.data?.actual.puesto
              ? `Puesto ${state.data.actual.puesto} de ${state.data.actual.totalVendedoras}. Las demás vendedoras se muestran sin nombre.`
              : "Las demás vendedoras se muestran sin nombre."
          }
        >
          {(data) => (
            <HBarList
              ariaLabel="Ranking de vendedoras por facturación"
              formatValue={formatSoles}
              rows={data.actual.ranking.map((fila) => ({
                key: fila.asesorId,
                label: fila.esYo ? `${fila.nombre} (yo)` : fila.nombre,
                value: fila.facturacion,
                barColor: fila.esYo ? "var(--pc-primary)" : "var(--pc-border)",
                dotColor: fila.esYo ? "var(--pc-primary)" : "var(--pc-border)",
                onSelect: fila.esYo
                  ? () => openDrilldown(grupos.de("ventas", "Mis ventas"))
                  : undefined,
              }))}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Mis pedidos aún no cobrados"
        subtitulo="En curso o entregados sin liquidar. ⚑ = cliente con rechazos previos."
      >
        {(data, origin) => (
          <DataTable
            caption="Mis pedidos aún no cobrados"
            columns={columnasNoCobrados}
            rows={data.actual.noCobrados}
            getRowKey={(fila) => fila.id}
            exportar={{
              titulo: "Mis pedidos no cobrados",
              nombreBase: "mis_no_cobrados",
              origen: origin.kind,
            }}
            emptyMessage="Todo lo tuyo del periodo ya está cobrado"
            maxHeight={480}
          />
        )}
      </ContractBlock>
    </div>
  );
}
