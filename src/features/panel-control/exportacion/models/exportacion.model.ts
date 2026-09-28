import type { DataOriginKind } from "../../shared/models/data-origin.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";

export const HOJAS_LIBRO_COMPLETO = [
  "Resumen",
  "Canales",
  "Pedidos",
  "Productos",
  "Vendedoras",
  "Confirmadoras",
  "Couriers",
  "Departamentos",
  "Cuadres",
] as const;

export type HojaLibroCompleto = (typeof HOJAS_LIBRO_COMPLETO)[number];

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

export interface CompartirReporteResponse {
  periodo: string;
  ventaTotal: number;
  pedidos: number;
  producto?: number;
  productoIncompleto?: boolean;
  publicidad: number | null;
  envios?: number;
  costoPorVenta: number | null;
  gananciaSobreVentaTotal?: number;
  entregado: number;
  efectividadEntrega: number | null;
  gananciaSobreEntregado?: number;
  meDeben: number;
  vencido: number | null;
  texto: string;
}
