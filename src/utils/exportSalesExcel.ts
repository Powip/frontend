import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Interface for sale data to export
 */
export interface SaleExportData {
  orderNumber: string;
  clientName: string;
  phoneNumber: string;
  documentType?: string | null;
  documentNumber?: string | null;
  date: string;
  total: number;
  advancePayment: number;
  pendingPayment: number;
  status: string;
  salesRegion: string;
  province?: string;
  city?: string;
  district: string;
  zone?: string;
  address: string;
  paymentMethod: string;
  deliveryType: string;
  courier?: string | null;
  guideNumber?: string | null;
}

/**
 * Export sales data to Excel (XLSX format)
 * @param sales - Array of sale data to export
 * @param filenamePrefix - Prefix for the filename (e.g., "operaciones_preparados")
 */
export function exportSalesToExcel(
  sales: SaleExportData[],
  filenamePrefix: string,
): void {
  if (!sales || sales.length === 0) {
    console.warn("No hay datos para exportar");
    return;
  }

  const exportData = sales.map((s, index) => ({
    "N°": index + 1,
    Orden: s.orderNumber,
    Cliente: s.clientName,
    Teléfono: s.phoneNumber,
    "Tipo Doc": s.documentType || "-",
    "N° Documento": s.documentNumber || "-",
    Fecha: s.date,
    Total: s.total.toFixed(2),
    Adelanto: s.advancePayment.toFixed(2),
    "Por Cobrar": s.pendingPayment.toFixed(2),
    Estado: s.status,
    Región: s.salesRegion,
    Provincia: s.province || "-",
    Ciudad: s.city || "-",
    Distrito: s.district || "-",
    Zona: s.zone || "-",
    Dirección: s.address || "-",
    "Método Pago": s.paymentMethod,
    "Tipo Entrega": s.deliveryType,
    Courier: s.courier || "-",
    "N° Guía": s.guideNumber || "-",
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

  // Create Excel file
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const today = new Date().toISOString().split("T")[0];
  saveAs(blob, `${filenamePrefix}_${today}.xlsx`);
}

/**
 * Interface for seguimiento (shipping tracking) export data
 */
export interface SeguimientoExportData extends SaleExportData {
  daysSinceCreated?: number;
  guideStatus?: string;
}

/**
 * Export seguimiento data to Excel with additional shipping columns
 */
export function exportSeguimientoToExcel(
  items: SeguimientoExportData[],
  filenamePrefix: string,
): void {
  if (!items || items.length === 0) {
    console.warn("No hay datos para exportar");
    return;
  }

  const exportData = items.map((s, index) => ({
    "N°": index + 1,
    Orden: s.orderNumber,
    Cliente: s.clientName,
    Teléfono: s.phoneNumber,
    "Tipo Doc": s.documentType || "-",
    "N° Documento": s.documentNumber || "-",
    Fecha: s.date,
    Total: s.total.toFixed(2),
    Adelanto: s.advancePayment.toFixed(2),
    "Por Cobrar": s.pendingPayment.toFixed(2),
    "Estado Venta": s.status,
    Región: s.salesRegion,
    Provincia: s.province || "-",
    Ciudad: s.city || "-",
    Distrito: s.district || "-",
    Zona: s.zone || "-",
    Dirección: s.address || "-",
    Courier: s.courier || "-",
    "N° Guía": s.guideNumber || "-",
    "Estado Envío": s.guideStatus || "-",
    "Días Transcurridos": s.daysSinceCreated ?? "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Seguimiento");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const today = new Date().toISOString().split("T")[0];
  saveAs(blob, `${filenamePrefix}_${today}.xlsx`);
}
