import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  SUB_ESTADO_LABEL,
  MAX_INTENTOS_CC,
  resolveStoreName,
  getPedidoMontos,
  getUpsellCount,
  isDniFaltante,
  getAliclikLabel,
  getEvaLabel,
  getResumenProductos,
} from "@/components/atencion-cliente/cc-v2/ccPedidoFields";

const MONEY_FMT = '"S/" #,##0.00';
const DATE_FMT = "dd/mm/yyyy hh:mm";

/**
 * Columnas de datos de CcPedidosTable (incluidas Vendedor y Región, que quedan
 * fuera del área visible). No se exportan el checkbox ni los botones de acciones;
 * "Resumen" (botón "Ver") se exporta como el resumen de productos del pedido.
 */
const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "N° Orden", key: "orderNumber", width: 16, style: { numFmt: "@" } },
  { header: "Fecha", key: "fecha", width: 17, style: { numFmt: DATE_FMT } },
  { header: "Cliente", key: "cliente", width: 30 },
  { header: "DNI", key: "dni", width: 14, style: { numFmt: "@" } },
  { header: "Teléfono", key: "telefono", width: 15, style: { numFmt: "@" } },
  { header: "Tienda", key: "tienda", width: 18 },
  { header: "Canal", key: "canal", width: 18 },
  { header: "Subestado", key: "subestado", width: 15 },
  { header: "Aliclik", key: "aliclik", width: 15 },
  { header: "EVA", key: "eva", width: 18 },
  { header: "Adelanto", key: "adelanto", width: 13, style: { numFmt: MONEY_FMT } },
  { header: "Por cobrar", key: "porCobrar", width: 13, style: { numFmt: MONEY_FMT } },
  { header: "Total", key: "total", width: 13, style: { numFmt: MONEY_FMT } },
  { header: "Upsell", key: "upsell", width: 9 },
  { header: "Intentos", key: "intentos", width: 10 },
  { header: "Vendedor", key: "vendedor", width: 22 },
  { header: "Región", key: "region", width: 12 },
  { header: "Resumen", key: "resumen", width: 60 },
];

/**
 * ExcelJS serializa las fechas en UTC: se reconstruye la fecha con los
 * componentes locales para que la celda muestre la misma hora que la tabla.
 */
function toExcelLocalDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
}

export function buildCcPedidoRow(order: OrderHeader) {
  const { grandTotal, totalPaid, porCobrar } = getPedidoMontos(order);
  return {
    orderNumber: String(order.orderNumber ?? ""),
    fecha: toExcelLocalDate(order.created_at),
    cliente: order.customer?.fullName ?? "",
    dni: order.dniCliente ?? (isDniFaltante(order) ? "Faltante" : ""),
    telefono: String(order.customer?.phoneNumber ?? ""),
    tienda: resolveStoreName(order) ?? "",
    canal: order.canalOrigen ?? "",
    subestado: order.subEstadoCc ? SUB_ESTADO_LABEL[order.subEstadoCc] : "",
    aliclik: getAliclikLabel(order),
    eva: getEvaLabel(order),
    adelanto: totalPaid,
    porCobrar,
    total: grandTotal,
    upsell: getUpsellCount(order),
    intentos: `${order.callAttempts ?? 0}/${MAX_INTENTOS_CC}`,
    vendedor: order.sellerName ?? "",
    region: order.salesRegion ?? "",
    resumen: getResumenProductos(order),
  };
}

export function buildCcPedidosWorkbook(orders: OrderHeader[], sheetName: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = COLUMNS;
  worksheet.addRows(orders.map(buildCcPedidoRow));

  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  // El encabezado es texto: sin esto hereda numFmt de moneda/fecha de la columna.
  header.eachCell((cell) => { cell.numFmt = "General"; });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + orders.length, column: COLUMNS.length },
  };

  return workbook;
}

/** Nombre: pedidos_cod_<pestaña>_<yyyy-MM-dd>.xlsx */
export function ccPedidosFileName(tabLabel: string, date = new Date()): string {
  const slug = tabLabel
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `pedidos_cod_${slug}_${format(date, "yyyy-MM-dd")}.xlsx`;
}

export async function exportCcPedidosToExcel(orders: OrderHeader[], tabLabel: string): Promise<void> {
  const workbook = buildCcPedidosWorkbook(orders, tabLabel);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, ccPedidosFileName(tabLabel));
}
