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
  sellerName?: string | null;
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
    Vendedor: s.sellerName || "-",
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
  trackingLink?: string;
  externalTrackingNumber?: string;
  shippingCode?: string;
  shippingKey?: string;
  shippingOffice?: string;
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
    FECHA: s.date,
    "# PEDIDO": s.orderNumber,
    "NOMBRES Y APELLIDOS": s.clientName,
    DNI: s.documentNumber || "-",
    TELEFONO: s.phoneNumber,
    DEPARTAMENTO: s.province || "-",
    PROVINCIA: s.province || "-",
    DISTRITO: s.district || "-",
    "OFICINA - DIRECCION": s.shippingOffice
      ? `${s.shippingOffice}${s.address && s.address !== "-" ? ` - ${s.address}` : ""}`
      : s.address || "-",
    "N° DE ORDEN": s.externalTrackingNumber || "-",
    CODIGO: s.shippingCode || "-",
    CLAVE: s.shippingKey ? s.shippingKey : "-",
    "VENDEDOR/A": s.sellerName || "-",
    ESTADO: s.status,
    "METODO PAGO": s.paymentMethod || "-",
    "M.VENTA": s.total.toFixed(2),
    ADELANTO: s.advancePayment.toFixed(2),
    "ESTADO SALIDA": s.guideStatus || "-",
    "MONTO SALDO PENDIENTE": s.pendingPayment.toFixed(2),
    "ESTADO FINAL": s.guideStatus || "-",
    COURIER: s.courier || "-",
    "N° GUIA": s.guideNumber || "-",
    REGION: s.salesRegion,
    "LINK RASTREO": s.trackingLink || "-",
    "DIAS TRANSCURRIDOS": s.daysSinceCreated ?? "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Make LINK RASTREO column clickable hyperlinks
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  // Find the column index for "LINK RASTREO"
  let linkColIndex = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (headerCell && headerCell.v === "LINK RASTREO") {
      linkColIndex = c;
      break;
    }
  }
  if (linkColIndex >= 0) {
    for (let r = 1; r <= range.e.r; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: linkColIndex });
      const cell = worksheet[cellRef];
      if (cell && cell.v && cell.v !== "-") {
        cell.l = { Target: cell.v, Tooltip: "Abrir rastreo" };
      }
    }
  }

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
