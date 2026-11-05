import type { DataOriginKind } from "../../shared/models/data-origin.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";

export interface ExportLibroQuery extends PanelQuery {
  formato: "xlsx";
}

export interface ExportLibroResponse {
  archivo: Blob;
  nombreArchivo: string;
}

export type ExportCellValue = string | number | null;

export interface ExportColumn {
  id: string;
  encabezado: string;
  formato: "texto" | "soles" | "porcentaje" | "numero";
}

export interface ExportTablaRequest {
  titulo: string;
  periodo: string;
  filtros: string;
  origen: DataOriginKind;
  generadoEn: string;
  columnas: ExportColumn[];
  filas: ExportCellValue[][];
  nombreBase: string;
  desde: string;
  hasta: string;
}

/**
 * GET /panel/compartir (objeto plano, sin envelope). Solo llega al Dueño, por eso las cifras de
 * costo existen siempre; valen `null` cuando no hay dato (R13: nunca 0). No existe una ganancia
 * sobre venta total: hay una sola, sobre lo entregado.
 */
export interface CompartirReporteResponse {
  periodo: string;
  ventaTotal: number;
  pedidos: number;
  producto: number | null;
  productoIncompleto: boolean;
  publicidad: number | null;
  envios: number | null;
  costoPorVenta: number | null;
  entregado: number;
  efectividadEntrega: number | null;
  gananciaSobreEntregado: number | null;
  meDeben: number;
  vencido: number | null;
  texto: string;
}
