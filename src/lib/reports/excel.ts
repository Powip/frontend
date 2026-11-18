import ExcelJS from "exceljs";

// FEAT-24 H10-D5 — Excel de los reportes de inventario y compras (exceljs en el
// navegador, como el resto de la app). Cada libro empieza con la hoja «Filtros»:
// qué reporte es, quién y cuándo lo generó y los mismos filtros de la pantalla.
// Sin permiso de costos la API omite esas claves y las columnas de valor ni
// siquiera se agregan.

export type CellValue = string | number | null | undefined;

export interface SheetColumn {
  header: string;
  key: string;
  width?: number;
  /** Formato numérico de Excel (p. ej. `#,##0.00`). */
  numFmt?: string;
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  rows: Array<Record<string, CellValue>>;
}

export interface WorkbookSpec {
  title: string;
  /** Filtros aplicados, en el orden de la pantalla. */
  filters: Array<[string, string]>;
  generatedBy?: string;
  generatedAt?: Date;
  sheets: SheetSpec[];
}

export const MONEY_FMT = '"S/" #,##0.00';
export const COST_FMT = '"S/" #,##0.0000';
export const QTY_FMT = "#,##0";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF027778" } };

/** Nombre de hoja válido para Excel (31 caracteres, sin `[]:*?/\`). */
export function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Hoja";
}

function limaTimestamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Arma el libro: «Filtros» y después las hojas pedidas, con encabezado congelado y autofiltro. */
export function buildReportWorkbook(spec: WorkbookSpec): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POWIP";
  workbook.created = spec.generatedAt ?? new Date();

  const filters = workbook.addWorksheet("Filtros");
  filters.columns = [
    { header: "Dato", key: "label", width: 26 },
    { header: "Valor", key: "value", width: 60 },
  ];
  filters.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  filters.getRow(1).fill = HEADER_FILL;
  filters.addRow({ label: "Reporte", value: spec.title });
  filters.addRow({ label: "Generado el", value: limaTimestamp(spec.generatedAt ?? new Date()) });
  if (spec.generatedBy) filters.addRow({ label: "Generado por", value: spec.generatedBy });
  for (const [label, value] of spec.filters) filters.addRow({ label, value });

  for (const sheet of spec.sheets) {
    const worksheet = workbook.addWorksheet(sheetName(sheet.name));
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? Math.max(12, column.header.length + 2),
      ...(column.numFmt ? { style: { numFmt: column.numFmt } } : {}),
    }));
    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = HEADER_FILL;
    header.alignment = { vertical: "middle" };
    for (const row of sheet.rows) {
      const values: Record<string, string | number | null> = {};
      for (const column of sheet.columns) {
        const value = row[column.key];
        values[column.key] = value === undefined ? null : value;
      }
      worksheet.addRow(values);
    }
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    if (sheet.columns.length) {
      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rows.length + 1), column: sheet.columns.length } };
    }
  }
  return workbook;
}

/** Nombre de archivo sin caracteres raros, con extensión .xlsx. */
export function excelFileName(name: string): string {
  const base = name
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "reporte"}.xlsx`;
}

/** Escribe el libro y lo descarga. */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = excelFileName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}
