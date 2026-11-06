"use client";

import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import type { SesionLive } from "@/features/panel-control/canales/models/canal-detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { DataOriginKind } from "@/features/panel-control/shared/models/data-origin.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
} from "@/features/panel-control/shared/utils/format";
import { CeldaDrill } from "./CeldaDrill";

const HORA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const FECHA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "numeric",
  month: "short",
});

export function etiquetaSesion(sesion: SesionLive): string {
  const inicio = new Date(sesion.inicio);
  return `${FECHA.format(inicio)} · ${HORA.format(inicio)}–${HORA.format(new Date(sesion.fin))}`;
}

interface SesionesLiveTablaProps {
  sesiones: SesionLive[];
  origen: DataOriginKind;
  canalId?: string;
}

export function SesionesLiveTabla({ sesiones, origen, canalId }: SesionesLiveTablaProps) {
  const { openDrilldown } = usePanel();
  const { tiendaNombre } = usePanelOptions();
  const variasTiendas = new Set(sesiones.map((sesion) => sesion.tiendaId)).size > 1;

  const columnas: DataTableColumn<SesionLive>[] = [
    {
      id: "sesion",
      header: "Sesión (hora Lima)",
      align: "left",
      cell: (fila) => (
        <CeldaDrill
          ariaLabel={`Ver pedidos de la sesión ${etiquetaSesion(fila)}`}
          onSelect={() =>
            openDrilldown(
              grupos.de("ventas", `Live ${etiquetaSesion(fila)} · ventas`, {
                sesion: fila.sesionId,
                ...(canalId ? { canal: canalId } : {}),
              }),
            )
          }
        >
          {etiquetaSesion(fila)}
          {variasTiendas && (
            <span className="text-pc-text-muted">
              · {tiendaNombre(fila.tiendaId) ?? fila.tiendaId}
            </span>
          )}
        </CeldaDrill>
      ),
      sortValue: (fila) => fila.inicio,
      exportValue: (fila) => etiquetaSesion(fila),
    },
    {
      id: "inversion",
      header: "Inversión",
      cell: (fila) => formatSoles(fila.inversion),
      sortValue: (fila) => fila.inversion,
      exportValue: (fila) => fila.inversion,
      exportFormat: "soles",
    },
    {
      id: "leads",
      header: "Leads",
      cell: (fila) => formatNumber(fila.leads),
      sortValue: (fila) => fila.leads,
      exportValue: (fila) => fila.leads,
      exportFormat: "numero",
    },
    {
      id: "confirmados",
      header: "Confirmados",
      cell: (fila) => formatNumber(fila.llamados),
      sortValue: (fila) => fila.llamados,
      exportValue: (fila) => fila.llamados,
      exportFormat: "numero",
    },
    {
      id: "confirmacion",
      header: "Confirmación",
      cell: (fila) => formatPercent(fila.confirmacion),
      sortValue: (fila) => fila.confirmacion,
      exportValue: (fila) => fila.confirmacion,
      exportFormat: "porcentaje",
    },
    {
      id: "facturacion",
      header: "Facturación",
      cell: (fila) => formatSoles(fila.facturacion),
      sortValue: (fila) => fila.facturacion,
      exportValue: (fila) => fila.facturacion,
      exportFormat: "soles",
    },
    {
      id: "retorno",
      header: "Retorno",
      cell: (fila) => formatVeces(fila.retorno),
      sortValue: (fila) => fila.retorno,
      exportValue: (fila) => fila.retorno,
      exportFormat: "numero",
    },
    {
      id: "costo_venta",
      header: "Costo por venta",
      cell: (fila) => formatSoles(fila.costoPorVenta),
      sortValue: (fila) => fila.costoPorVenta,
      exportValue: (fila) => fila.costoPorVenta,
      exportFormat: "soles",
    },
    {
      id: "otro_canal",
      header: "Cerrados por otro canal",
      cell: (fila) => formatNumber(fila.cerradosPorOtroCanal),
      sortValue: (fila) => fila.cerradosPorOtroCanal,
      exportValue: (fila) => fila.cerradosPorOtroCanal,
      exportFormat: "numero",
    },
  ];

  return (
    <div className="space-y-2">
      <DataTable
        caption="Sesiones de TikTok Live"
        columns={columnas}
        rows={sesiones}
        getRowKey={(fila) => fila.sesionId}
        exportar={{ titulo: "Sesiones de TikTok Live", nombreBase: "sesiones_live", origen }}
        emptyMessage="Sin sesiones de Live en el periodo"
        maxHeight={420}
      />
      <p role="note" className="text-xs text-pc-text-muted">
        Cada venta se atribuye a la sesión y al canal donde entró el lead, aunque se haya cerrado
        por otro canal (por ejemplo, WhatsApp). «Cerrados por otro canal» muestra cuántas ventas
        pasaron por ese cierre; no suman dos veces.
      </p>
    </div>
  );
}
