import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { slugify } from "../../shared/utils/format";
import type {
  ExportCellValue,
  ExportColumn,
  ExportTablaRequest,
} from "../models/exportacion.model";

const FORMATO_SOLES = '"S/ "#,##0.00';
const FORMATO_PORCENTAJE = "0.0%";

const ORIGEN_TEXTO = {
  real: "Datos reales",
  demo: "DATOS DEMO — no usar para decisiones: el contrato del backend está pendiente",
  pendiente: "Sin datos: contrato pendiente",
} as const;

function toCell(value: ExportCellValue, column: ExportColumn | null): XLSX.CellObject {
  if (value === null) return { t: "s", v: "—" };
  if (typeof value === "number" && Number.isFinite(value)) {
    if (column?.formato === "soles")
      return { t: "n", v: Math.round(value * 100) / 100, z: FORMATO_SOLES };
    if (column?.formato === "porcentaje") return { t: "n", v: value, z: FORMATO_PORCENTAJE };
    return { t: "n", v: value };
  }
  return { t: "s", v: String(value) };
}

export function buildTableSheet(request: ExportTablaRequest): XLSX.WorkSheet {
  const cabecera: ExportCellValue[][] = [
    ["POWIP · Panel de Control"],
    [request.titulo],
    ["Periodo", request.periodo],
    ["Filtros", request.filtros],
    ["Generado", request.generadoEn],
    ["Origen", ORIGEN_TEXTO[request.origen]],
    [],
  ];
  const sheet: XLSX.WorkSheet = {};
  const filas: { valores: ExportCellValue[]; columnas: boolean }[] = [
    ...cabecera.map((valores) => ({ valores, columnas: false })),
    { valores: request.columnas.map((columna) => columna.encabezado), columnas: false },
    ...request.filas.map((valores) => ({ valores, columnas: true })),
  ];
  let maxColumnas = 1;
  filas.forEach((fila, rowIndex) => {
    maxColumnas = Math.max(maxColumnas, fila.valores.length);
    fila.valores.forEach((valor, colIndex) => {
      const columna = fila.columnas ? (request.columnas[colIndex] ?? null) : null;
      sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })] = toCell(valor, columna);
    });
  });
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(0, filas.length - 1), c: maxColumnas - 1 },
  });
  sheet["!cols"] = Array.from({ length: maxColumnas }, (_, index) => ({
    wch: Math.min(40, Math.max(12, (request.columnas[index]?.encabezado.length ?? 10) + 4)),
  }));
  return sheet;
}

const nombreHoja = (nombre: string) => nombre.slice(0, 31).replace(/[\\/?*[\]:]/g, " ");

export function buildTableWorkbook(request: ExportTablaRequest): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildTableSheet(request), nombreHoja(request.titulo));
  return workbook;
}

export function buildLibroWorkbook(hojas: { nombre: string; request: ExportTablaRequest }[]) {
  const workbook = XLSX.utils.book_new();
  for (const hoja of hojas) {
    XLSX.utils.book_append_sheet(workbook, buildTableSheet(hoja.request), nombreHoja(hoja.nombre));
  }
  return workbook;
}

export function workbookBlob(workbook: XLSX.WorkBook): Blob {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function libroFileName(desde: string, hasta: string, demo: boolean): string {
  return `powip_panel_${desde}_${hasta}${demo ? "_DEMO" : ""}.xlsx`;
}

export function tableFileName(request: ExportTablaRequest): string {
  const sufijo = request.origen === "demo" ? "_DEMO" : "";
  return `powip_${slugify(request.nombreBase)}_${request.desde}_${request.hasta}${sufijo}.xlsx`;
}

export function exportTable(request: ExportTablaRequest): string {
  const nombre = tableFileName(request);
  saveAs(workbookBlob(buildTableWorkbook(request)), nombre);
  return nombre;
}
