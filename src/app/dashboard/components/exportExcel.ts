"use client";

import { toast } from "sonner";

interface ExcelColumn {
  header: string;
  width: number;
}

type ExcelCellValue = string | number;

const DARK_NAVY = "FF1B2A3B";
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 } as const;
const TITLE_FONT = { bold: true, size: 13, color: { argb: "FF1B2A3B" } } as const;
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFDDDDDD" } },
  left: { style: "thin", color: { argb: "FFDDDDDD" } },
  bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
  right: { style: "thin", color: { argb: "FFDDDDDD" } },
} as const;

/** Exporta una tabla del dashboard a un .xlsx con título + encabezado estilizado. */
export async function exportTableToExcel(
  sheetName: string,
  title: string,
  columns: ExcelColumn[],
  rows: ExcelCellValue[][],
  fileName: string,
) {
  if (rows.length === 0) {
    toast.warning("No hay datos para exportar en el período seleccionado.");
    return;
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  ws.addRow([title]);
  ws.mergeCells(1, 1, 1, columns.length);
  ws.getCell("A1").font = TITLE_FONT;
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_NAVY } };
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
  });

  rows.forEach((r) => {
    const dataRow = ws.addRow(r);
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle" };
    });
  });

  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  toast.success(`${rows.length} filas exportadas`);
}
