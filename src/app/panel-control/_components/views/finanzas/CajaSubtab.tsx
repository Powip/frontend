"use client";

import { BarChart } from "@/components/panel-control/charts/BarChart";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { KpiCard } from "@/components/panel-control/KpiCard";
import {
  type CajaMovimiento,
  CONCEPTO_EGRESO_LABEL,
  type ConceptoEgresoCaja,
  FUENTE_INGRESO_LABEL,
  type FuenteIngresoCaja,
} from "@/features/panel-control/finanzas/models/caja.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatDayKey,
  formatNumber,
  formatSoles,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "../ventas/CeldaDrill";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

const SIN_PEDIDOS: Partial<Record<FuenteIngresoCaja | ConceptoEgresoCaja, string>> = {
  adelantos: "Pendiente: falta registrar adelanto_monto y fecha_adelanto por pedido",
  publicidad:
    "Pauta registrada por fecha; el desglose por día está en Ventas y canales → Publicidad",
  gastos_fijos: "Gastos fijos del mes prorrateados por día (valor demo)",
};

export function CajaSubtab() {
  const { view, openDrilldown } = usePanel();
  const state = usePanelContract("finanzas-caja", view.access === "permitido" ? view.query : null);

  function columnas<T extends FuenteIngresoCaja | ConceptoEgresoCaja>(
    etiquetas: Record<T, string>,
    tipo: "entradas" | "salidas",
  ): DataTableColumn<CajaMovimiento<T>>[] {
    return [
      {
        id: "concepto",
        header: tipo === "entradas" ? "Entró por" : "Salió por",
        align: "left",
        cell: (fila) =>
          fila.pedidos ? (
            <CeldaDrill
              ariaLabel={`Ver pedidos de ${etiquetas[fila.concepto]}`}
              onSelect={() =>
                openDrilldown(grupos.caja(etiquetas[fila.concepto], { concepto: fila.concepto }))
              }
            >
              {etiquetas[fila.concepto]}
            </CeldaDrill>
          ) : (
            <span>
              {etiquetas[fila.concepto]}
              {SIN_PEDIDOS[fila.concepto] && (
                <span className="block text-[11px] text-pc-text-muted">
                  {SIN_PEDIDOS[fila.concepto]}
                </span>
              )}
            </span>
          ),
        sortValue: (fila) => etiquetas[fila.concepto],
        exportValue: (fila) => etiquetas[fila.concepto],
      },
      {
        id: "monto",
        header: "Monto",
        cell: (fila) =>
          fila.monto === null ? (
            <span className="text-pc-warn">Pendiente</span>
          ) : (
            formatSoles(fila.monto)
          ),
        sortValue: (fila) => fila.monto,
        exportValue: (fila) => fila.monto,
        exportFormat: "soles",
      },
      {
        id: "pedidos",
        header: "Pedidos",
        cell: (fila) => (fila.pedidos === null ? SIN_DATO : formatNumber(fila.pedidos)),
        sortValue: (fila) => fila.pedidos,
        exportValue: (fila) => fila.pedidos,
        exportFormat: "numero",
      },
    ];
  }

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <KpiRow
        state={state}
        labels={["Entró", "Salió", "Neto de caja", "Entra por día"]}
        titulo="Caja del periodo"
      >
        {(data, origin) => {
          const c = data.actual;
          const a = data.anterior_misma_antiguedad;
          return [
            <KpiCard
              key="entro"
              label="Entró"
              value={formatSoles(c.totalEntro)}
              origin={origin}
              delta={a ? calcularDelta(c.totalEntro, a.totalEntro) : undefined}
              sub="Liquidaciones, caja POS y prepagos cobrados en el periodo"
              onDrill={() => openDrilldown(grupos.caja("Dinero que entró", {}))}
            />,
            <KpiCard
              key="salio"
              label="Salió"
              value={formatSoles(c.totalSalio)}
              origin={origin}
              delta={a ? calcularDelta(c.totalSalio, a.totalSalio, "menos_es_mejor") : undefined}
              sub="No incluye compras de mercadería"
            />,
            <KpiCard
              key="neto"
              label="Neto de caja"
              value={
                <span className={c.netoCaja < 0 ? "text-pc-bad" : undefined}>
                  {formatSoles(c.netoCaja)}
                </span>
              }
              origin={origin}
              delta={a ? calcularDelta(c.netoCaja, a.netoCaja) : undefined}
              sub="Entró − salió, por fecha del dinero"
            />,
            <KpiCard
              key="promedio"
              label="Entra por día"
              value={formatSoles(c.promedioDiarioEntra)}
              origin={origin}
              sub={`Promedio de ${formatNumber(c.dias)} días transcurridos`}
            />,
          ];
        }}
      </KpiRow>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ContractBlock
          state={state}
          titulo="Entradas por fuente"
          subtitulo="En la fecha en que el dinero llegó: liquidación del courier o del marketplace, caja POS o pago en línea"
        >
          {(data, origin) => (
            <DataTable
              caption="Entradas de caja por fuente"
              columns={columnas(FUENTE_INGRESO_LABEL, "entradas")}
              rows={data.actual.entradas}
              getRowKey={(fila) => fila.concepto}
              exportar={{
                titulo: "Entradas de caja",
                nombreBase: "caja_entradas",
                origen: origin.kind,
              }}
              footer={{ concepto: "Total", monto: formatSoles(data.actual.totalEntro) }}
            />
          )}
        </ContractBlock>
        <ContractBlock
          state={state}
          titulo="Salidas"
          subtitulo="Pauta por su fecha, fletes por fecha de envío (retorno de provincia en la fecha del rechazo), pasarela y comisiones al cobrar"
        >
          {(data, origin) => (
            <DataTable
              caption="Salidas de caja"
              columns={columnas(CONCEPTO_EGRESO_LABEL, "salidas")}
              rows={data.actual.salidas}
              getRowKey={(fila) => fila.concepto}
              exportar={{
                titulo: "Salidas de caja",
                nombreBase: "caja_salidas",
                origen: origin.kind,
              }}
              footer={{ concepto: "Total", monto: formatSoles(data.actual.totalSalio) }}
            />
          )}
        </ContractBlock>
      </div>
      <ContractBlock
        state={state}
        titulo="Dinero que entró por día"
        subtitulo="Por fecha del dinero. Clic o Enter abre los pedidos cobrados ese día."
        skeleton="grafico"
      >
        {(data) => {
          const dias = data.actual.porDia;
          return (
            <BarChart
              ariaLabel="Dinero que entró por día"
              formatAxis={axisSoles}
              color="var(--pc-series-3)"
              height={220}
              width={1000}
              data={dias.map((dia) => ({
                key: dia.dia,
                label: dias.length > 2 ? String(Number(dia.dia.slice(8))) : formatDayKey(dia.dia),
                value: dia.entro,
                description: `${formatDayKey(dia.dia)}: entró ${formatSoles(dia.entro)} · salió ${formatSoles(dia.salio)}`,
                onSelect: dia.entro
                  ? () =>
                      openDrilldown(
                        grupos.caja(`Cobrado el ${formatDayKey(dia.dia)}`, { dia_cobro: dia.dia }),
                      )
                  : undefined,
              }))}
            />
          );
        }}
      </ContractBlock>
    </div>
  );
}
