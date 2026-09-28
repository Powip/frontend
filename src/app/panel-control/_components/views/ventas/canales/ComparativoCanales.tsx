"use client";

import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { SegmentedControl } from "@/components/panel-control/SegmentedControl";
import type { CanalFicha } from "@/features/panel-control/canales/models/canal-ficha.model";
import type {
  CanalEntregasFila,
  CanalesComparativo,
  CanalGananciaFila,
  CanalVentasFila,
  VistaComparativo,
} from "@/features/panel-control/canales/models/canales-comparativo.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOriginKind } from "@/features/panel-control/shared/models/data-origin.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { COLOR_SIN_CANAL, colorCanal } from "@/features/panel-control/shared/utils/canal-color";
import {
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill, PuntoColor } from "../CeldaDrill";
import { ContractBlock } from "../ContractBlock";

type Fila = { canalId: string | null };

const SUBTITULO: Record<VistaComparativo, string> = {
  ventas: "Leads, ventas, facturación y avance de meta por canal de origen",
  entregas: "Qué se entregó, qué se rechazó y cuánto ya se cobró",
  ganancia:
    "Entregado menos costo de producto, publicidad (directa + general estimada), comisión y flete",
};

function columnaCanal<T extends Fila>(
  fichas: Map<string, CanalFicha>,
  abrir: (canalId: string | null, nombre: string | null) => void,
): DataTableColumn<T> {
  const nombre = (fila: T) =>
    fila.canalId ? (fichas.get(fila.canalId)?.nombre ?? fila.canalId) : "Sin canal";
  return {
    id: "canal",
    header: "Canal",
    align: "left",
    cell: (fila) => {
      const ficha = fila.canalId ? fichas.get(fila.canalId) : undefined;
      return (
        <CeldaDrill
          ariaLabel={`Ver ventas de ${nombre(fila)}`}
          onSelect={() => abrir(fila.canalId, fila.canalId ? nombre(fila) : null)}
        >
          <PuntoColor
            color={fila.canalId ? colorCanal(fila.canalId, ficha?.color ?? null) : COLOR_SIN_CANAL}
          />
          <span className="truncate">{nombre(fila)}</span>
        </CeldaDrill>
      );
    },
    sortValue: (fila) => nombre(fila),
    exportValue: (fila) => nombre(fila),
  };
}

function soles<T>(
  id: string,
  header: string,
  valor: (fila: T) => number | null,
  capability?: DataTableColumn<T>["capability"],
): DataTableColumn<T> {
  return {
    id,
    header,
    capability,
    cell: (fila) => formatSoles(valor(fila)),
    sortValue: valor,
    exportValue: valor,
    exportFormat: "soles",
  };
}

function numero<T>(
  id: string,
  header: string,
  valor: (fila: T) => number | null,
): DataTableColumn<T> {
  return {
    id,
    header,
    cell: (fila) => formatNumber(valor(fila)),
    sortValue: valor,
    exportValue: valor,
    exportFormat: "numero",
  };
}

function porcentaje<T>(
  id: string,
  header: string,
  valor: (fila: T) => number | null,
): DataTableColumn<T> {
  return {
    id,
    header,
    cell: (fila) => formatPercent(valor(fila)),
    sortValue: valor,
    exportValue: valor,
    exportFormat: "porcentaje",
  };
}

interface TablaProps {
  data: CanalesComparativo;
  origen: DataOriginKind;
  abrir: (canalId: string | null, nombre: string | null) => void;
}

function TablaComparativo({ data, origen, abrir }: TablaProps): ReactNode {
  const fichas = new Map(data.canales.map((ficha) => [ficha.id, ficha]));
  const exportar = (titulo: string, nombreBase: string) => ({ titulo, nombreBase, origen });

  if (data.vista === "ventas") {
    const columnas: DataTableColumn<CanalVentasFila>[] = [
      columnaCanal(fichas, abrir),
      numero("leads", "Leads", (fila) => fila.leads),
      porcentaje("confirmacion", "Confirmación", (fila) => fila.confirmacion),
      numero("ventas", "Ventas", (fila) => fila.ventas),
      soles("facturacion", "Facturación", (fila) => fila.facturacion),
      porcentaje("participacion", "Part.", (fila) => fila.participacion),
      numero("unidades", "Unidades", (fila) => fila.unidades),
      soles("ticket", "Ticket", (fila) => fila.ticket),
      soles("descuentos", "Descuentos", (fila) => fila.descuentos),
      soles("upsell", "Upsell", (fila) => fila.upsell),
      soles("meta", "Meta del periodo", (fila) => fila.metaPeriodo),
      porcentaje("avance", "Avance", (fila) => fila.avanceMeta),
    ];
    const { total } = data;
    return (
      <DataTable
        caption="Comparativo de canales · ventas"
        columns={columnas}
        rows={data.filas}
        getRowKey={(fila) => fila.canalId ?? "sin-canal"}
        exportar={exportar("Comparativo de canales · ventas", "canales_ventas")}
        footer={{
          canal: "Total",
          leads: formatNumber(total.leads),
          confirmacion: formatPercent(total.confirmacion),
          ventas: formatNumber(total.ventas),
          facturacion: formatSoles(total.facturacion),
          participacion: formatPercent(total.participacion),
          unidades: formatNumber(total.unidades),
          ticket: formatSoles(total.ticket),
          descuentos: formatSoles(total.descuentos),
          upsell: formatSoles(total.upsell),
          meta: formatSoles(total.metaPeriodo),
          avance: formatPercent(total.avanceMeta),
        }}
      />
    );
  }

  if (data.vista === "entregas") {
    const columnas: DataTableColumn<CanalEntregasFila>[] = [
      columnaCanal(fichas, abrir),
      numero("ventas", "Ventas", (fila) => fila.ventas),
      numero("en_curso", "En curso", (fila) => fila.enCurso),
      numero("entregados", "Entregados", (fila) => fila.entregados),
      numero("rechazados", "Rechazados", (fila) => fila.rechazados),
      porcentaje("efectividad", "Efectividad", (fila) => fila.efectividadEntrega),
      porcentaje("primer_intento", "1.er intento", (fila) => fila.primerIntento),
      soles("flete", "Flete", (fila) => fila.flete ?? null, "ver_costos"),
      soles("pagado", "Pagado", (fila) => fila.pagado),
      soles("por_cobrar", "Por cobrar", (fila) => fila.porCobrar),
      soles("perdido", "Perdido", (fila) => fila.perdido),
    ];
    const { total } = data;
    return (
      <DataTable
        caption="Comparativo de canales · entregas y cobro"
        columns={columnas}
        rows={data.filas}
        getRowKey={(fila) => fila.canalId ?? "sin-canal"}
        exportar={exportar("Comparativo de canales · entregas y cobro", "canales_entregas")}
        footer={{
          canal: "Total",
          ventas: formatNumber(total.ventas),
          en_curso: formatNumber(total.enCurso),
          entregados: formatNumber(total.entregados),
          rechazados: formatNumber(total.rechazados),
          efectividad: formatPercent(total.efectividadEntrega),
          primer_intento: formatPercent(total.primerIntento),
          flete: formatSoles(total.flete ?? null),
          pagado: formatSoles(total.pagado),
          por_cobrar: formatSoles(total.porCobrar),
          perdido: formatSoles(total.perdido),
        }}
      />
    );
  }

  const columnas: DataTableColumn<CanalGananciaFila>[] = [
    columnaCanal(fichas, abrir),
    soles("facturacion", "Facturación", (fila) => fila.facturacion),
    soles("entregado", "Entregado", (fila) => fila.entregado),
    {
      ...soles<CanalGananciaFila>("costo", "Costo producto", (fila) => fila.costoProducto),
      cell: (fila) => (
        <span title={fila.costoIncompleto ? "Hay productos sin costo cargado" : undefined}>
          {formatSoles(fila.costoProducto)}
          {fila.costoIncompleto && <span className="text-pc-warn"> *</span>}
        </span>
      ),
    },
    soles("pauta_directa", "Pauta directa", (fila) => fila.pautaDirecta),
    {
      ...soles<CanalGananciaFila>(
        "pauta_general",
        "Pauta general (est.)",
        (fila) => fila.pautaGeneralEstimada,
      ),
      cell: (fila) => (
        <i className="text-pc-text-muted">{formatSoles(fila.pautaGeneralEstimada)}</i>
      ),
    },
    soles("comision", "Comisión", (fila) => fila.comision),
    soles("flete", "Flete", (fila) => fila.flete),
    {
      ...soles<CanalGananciaFila>("ganancia", "Ganancia", (fila) => fila.ganancia),
      cell: (fila) =>
        fila.gananciaParcial ? (
          <span className="text-pc-text-muted" title="Tope: hay entregas sin costo cargado">
            ≤ {formatSoles(fila.ganancia)}
          </span>
        ) : (
          <b>{formatSoles(fila.ganancia)}</b>
        ),
    },
    porcentaje("margen", "Margen", (fila) => fila.margen),
    {
      id: "retorno",
      header: "Retorno",
      cell: (fila) => formatVeces(fila.retornoPublicidad),
      sortValue: (fila) => fila.retornoPublicidad,
      exportValue: (fila) => fila.retornoPublicidad,
      exportFormat: "numero",
    },
    soles("costo_venta", "Costo por venta", (fila) => fila.costoPorVenta),
  ];
  const { total } = data;
  return (
    <div className="space-y-2">
      <DataTable
        caption="Comparativo de canales · ganancia"
        columns={columnas}
        rows={data.filas}
        getRowKey={(fila) => fila.canalId ?? "sin-canal"}
        exportar={exportar("Comparativo de canales · ganancia", "canales_ganancia")}
        footer={{
          canal: "Total",
          facturacion: formatSoles(total.facturacion),
          entregado: formatSoles(total.entregado),
          costo: formatSoles(total.costoProducto),
          pauta_directa: formatSoles(total.pautaDirecta),
          pauta_general: formatSoles(total.pautaGeneralEstimada),
          comision: formatSoles(total.comision),
          flete: formatSoles(total.flete),
          ganancia: total.gananciaParcial
            ? `≤ ${formatSoles(total.ganancia)}`
            : formatSoles(total.ganancia),
          margen: formatPercent(total.margen),
          retorno: formatVeces(total.retornoPublicidad),
          costo_venta: formatSoles(total.costoPorVenta),
        }}
      />
      <p role="note" className="text-xs text-pc-text-muted">
        <i>Pauta general (est.)</i> es un reparto estimado del presupuesto general según la
        facturación de cada canal que recibe pauta general; no es inversión registrada por canal.
        {total.gananciaParcial &&
          " * Hay entregas sin costo de producto cargado: «≤» indica que la ganancia es un tope, no la cifra final."}
      </p>
    </div>
  );
}

interface ComparativoCanalesProps {
  state: PanelContractState<"canales-comparativo">;
  vista: VistaComparativo;
  onVista: (vista: VistaComparativo) => void;
  verGanancia: boolean;
}

export function ComparativoCanales({
  state,
  vista,
  onVista,
  verGanancia,
}: ComparativoCanalesProps) {
  const { openDrilldown } = usePanel();
  const opciones: { value: VistaComparativo; label: string }[] = [
    { value: "ventas", label: "Ventas" },
    { value: "entregas", label: "Entregas y cobro" },
    ...(verGanancia ? [{ value: "ganancia" as const, label: "Ganancia" }] : []),
  ];
  return (
    <ContractBlock
      state={state}
      titulo="Comparativo de canales"
      subtitulo={SUBTITULO[vista]}
      acciones={
        <SegmentedControl
          ariaLabel="Vista del comparativo"
          options={opciones}
          value={vista}
          onChange={onVista}
        />
      }
    >
      {(data, origin) =>
        data.actual.vista === vista ? (
          <TablaComparativo
            data={data.actual}
            origen={origin.kind}
            abrir={(canalId, nombre) => openDrilldown(grupos.ventasCanal(canalId, nombre))}
          />
        ) : null
      }
    </ContractBlock>
  );
}
