"use client";

import { AccionDestinoLink } from "@/components/panel-control/AccionDestinoLink";
import { HBarList } from "@/components/panel-control/charts/HBarList";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { destinoAccion } from "@/features/panel-control/acciones/utils/destino-accion";
import {
  BUCKET_DEUDA_LABEL,
  type LiquidacionPendienteFila,
} from "@/features/panel-control/finanzas/models/cobranza.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatDays,
  formatNumber,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const COLOR_DEUDA = ["var(--pc-series-1)", "var(--pc-warn)", "var(--pc-warn)", "var(--pc-bad)"];

export function CobranzaSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract(
    "finanzas-cobranza",
    view.access === "permitido" ? view.query : null,
  );

  const columnas: DataTableColumn<LiquidacionPendienteFila>[] = [
    {
      id: "courier",
      header: "Courier",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver lo que ${fila.courier} no liquida`}
          onSelect={() =>
            openDrilldown(
              grupos.actual(
                "por_liquidar_actual",
                `${fila.courier} · por liquidar`,
                { courier: fila.courierId },
                "pedir_liquidacion",
              ),
            )
          }
        >
          {fila.courier}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.courier,
      exportValue: (fila) => fila.courier,
    },
    {
      id: "plazo",
      header: "Plazo pactado",
      cell: (fila) =>
        fila.plazoDias === null ? (
          <span className="text-pc-warn">Pendiente</span>
        ) : (
          formatDays(fila.plazoDias)
        ),
      sortValue: (fila) => fila.plazoDias,
      exportValue: (fila) => fila.plazoDias,
      exportFormat: "numero",
    },
    {
      id: "pedidos",
      header: "Pedidos",
      cell: (fila) => formatNumber(fila.pedidos),
      sortValue: (fila) => fila.pedidos,
      exportValue: (fila) => fila.pedidos,
      exportFormat: "numero",
    },
    {
      id: "monto",
      header: "Monto",
      cell: (fila) => formatSoles(fila.monto),
      sortValue: (fila) => fila.monto,
      exportValue: (fila) => fila.monto,
      exportFormat: "soles",
    },
    {
      id: "antiguo",
      header: "Más antiguo",
      cell: (fila) => formatDays(fila.diasMasAntiguo),
      sortValue: (fila) => fila.diasMasAntiguo,
      exportValue: (fila) => fila.diasMasAntiguo,
      exportFormat: "numero",
    },
    {
      id: "vencido",
      header: "Vencido",
      cell: (fila) =>
        fila.vencido === null ? (
          <span className="text-pc-warn" title="Sin plazo pactado no se puede saber si venció">
            Pendiente
          </span>
        ) : fila.vencido > 0 ? (
          <button
            type="button"
            onClick={() =>
              openDrilldown(
                grupos.actual(
                  "por_liquidar_actual",
                  `${fila.courier} · vencido`,
                  { courier: fila.courierId, vencido: "1" },
                  "pedir_liquidacion",
                ),
              )
            }
            aria-label={`Ver ${formatSoles(fila.vencido)} vencido de ${fila.courier}`}
            className="rounded font-semibold tabular-nums text-pc-bad underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            {formatSoles(fila.vencido)}
          </button>
        ) : (
          formatSoles(0)
        ),
      sortValue: (fila) => fila.vencido,
      exportValue: (fila) => fila.vencido,
      exportFormat: "soles",
    },
    {
      id: "accion",
      header: "Acción",
      cell: (fila) => {
        const destino = destinoAccion("pedir_liquidacion", { courier: fila.courier });
        return destino ? (
          <AccionDestinoLink
            destino={destino}
            ariaLabel={`Pedir liquidación a ${fila.courier}`}
            className="inline-block rounded-md border border-pc-border px-2 py-0.5 text-xs font-semibold text-pc-text outline-none hover:border-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
          >
            Pedir
          </AccionDestinoLink>
        ) : null;
      },
    },
  ];

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={["Por liquidar", "Vencido", "En curso por cobrar", "Adelantos de no entregadas"]}
        titulo="Cobranza"
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          return [
            <KpiCard
              key="por_liquidar"
              label="Por liquidar"
              glosario="por_liquidar"
              value={formatSoles(k.porLiquidar)}
              origin={origin}
              sub={
                <>
                  {formatNumber(k.pedidosPorLiquidar)} entregados con courier sin liquidar · últimos
                  365 días · estado actual
                  {k.porLiquidarSinPlazo > 0 && (
                    <span className="block text-pc-warn">
                      {formatSoles(k.porLiquidarSinPlazo)} de couriers sin plazo pactado
                    </span>
                  )}
                </>
              }
              onDrill={() =>
                openDrilldown(
                  grupos.actual(
                    "por_liquidar_actual",
                    "Entregado sin liquidar",
                    {},
                    "pedir_liquidacion",
                  ),
                )
              }
            />,
            <KpiCard
              key="vencido"
              label="Vencido"
              value={
                k.vencido === null ? (
                  <span className="text-pc-warn">Sin dato</span>
                ) : (
                  <span className="text-pc-bad">{formatSoles(k.vencido)}</span>
                )
              }
              origin={origin}
              sub={
                k.vencido === null
                  ? "Ningún courier con deuda tiene plazo pactado: no se puede saber si venció"
                  : `${formatNumber(k.pedidosVencidos)} pedidos pasaron el plazo del courier`
              }
              onDrill={
                k.vencido === null
                  ? undefined
                  : () =>
                      openDrilldown(
                        grupos.actual(
                          "por_liquidar_actual",
                          "Liquidación vencida",
                          { vencido: "1" },
                          "pedir_liquidacion",
                        ),
                      )
              }
            />,
            <KpiCard
              key="en_curso"
              label="En curso por cobrar"
              value={formatSoles(k.enCurso)}
              origin={origin}
              sub={`${formatNumber(k.pedidosEnCurso)} ventas aún no entregadas ni cobradas`}
              onDrill={() =>
                openDrilldown(grupos.actual("por_cobrar_actual", "En curso por cobrar"))
              }
            />,
            <KpiCard
              key="adelantos"
              label="Adelantos de no entregadas"
              value={
                k.adelantosDeNoEntregadas === null
                  ? "Pendiente"
                  : formatSoles(k.adelantosDeNoEntregadas)
              }
              origin={origin}
              sub="Dinero recibido antes de entregar: se devuelve si el pedido no se entrega"
            />,
          ];
        }}
      </KpiRow>
      {state.data && (
        <div className="space-y-1 rounded-xl border border-pc-border bg-pc-card px-3 py-2 text-xs text-pc-text-muted">
          <p>
            Cobranza es la deuda con couriers: entregados con courier sin pago completo, de los
            últimos 365 días y hasta 5000 pedidos. El «por liquidar» de Resultado también incluye
            retiro en tienda y POS, así que puede ser mayor.
          </p>
          <p>
            Tiempo hasta liquidar y liquidado por el courier: Pendiente: se conectará con
            Liquidaciones de courier.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <ContractBlock
          state={state}
          titulo="Liquidaciones pendientes por courier"
          subtitulo="Entregados con courier, estado actual, sin importar el periodo. «Pedir» necesita POST /panel/acciones."
        >
          {(data, origin) => (
            <DataTable
              caption="Liquidaciones pendientes por courier"
              columns={columnas}
              rows={data.actual.liquidacionesPendientes}
              getRowKey={(fila) => fila.courierId}
              exportar={{
                titulo: "Liquidaciones pendientes",
                nombreBase: "liquidaciones",
                origen: origin.kind,
              }}
              emptyMessage="Nada pendiente de liquidar"
            />
          )}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Antigüedad de lo que nos deben"
          subtitulo="Días desde la entrega de lo que falta liquidar"
        >
          {(data) => (
            <HBarList
              ariaLabel="Por liquidar según días desde la entrega"
              formatValue={formatSoles}
              rows={data.actual.antiguedad.map((fila, index) => ({
                key: fila.bucket,
                label: `${BUCKET_DEUDA_LABEL[fila.bucket]} · ${formatNumber(fila.pedidos)}`,
                value: fila.monto,
                barColor: COLOR_DEUDA[index],
                dotColor: COLOR_DEUDA[index],
                onSelect: fila.pedidos
                  ? () =>
                      openDrilldown(
                        grupos.actual(
                          "por_liquidar_actual",
                          `Por liquidar · ${BUCKET_DEUDA_LABEL[fila.bucket]}`,
                          { antiguedad_deuda: fila.bucket },
                          "pedir_liquidacion",
                        ),
                      )
                  : undefined,
              }))}
            />
          )}
        </ContractBlock>
      </div>
    </div>
  );
}
