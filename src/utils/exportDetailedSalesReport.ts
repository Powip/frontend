import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { OrderResponseDto, OrderItemResponseDto } from "@/api/sales/dto/order.dto";

/**
 * Detailed sale export row — 1 row per product/variant of an order
 * (as opposed to `SaleExportData` in `exportSalesExcel.ts`, which is 1 row per order).
 *
 * Used exclusively by the "Exportar a Excel" button of the "Funnel Efectividad COD"
 * card (dashboard > Resumen General). Do not reuse for `ventas/page.tsx` or
 * `finanzas/page.tsx` — those keep their 1-row-per-order export via `exportSalesToExcel`.
 */
export interface DetailedSaleExportRow {
  orderNumber: string;
  date: string;
  clientName: string;
  phoneNumber: string;
  documentType: string;
  documentNumber: string;
  province: string;
  city: string;
  district: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  total: number;
  advancePayment: number;
  pendingPayment: number;
  status: string;
  salesRegion: string;
  zone: string;
  address: string;
  paymentMethod: string;
  deliveryType: string;
  courier: string;
  sellerName: string;
  guideNumber: string;
  metaId: string;
  mapsLink: string;
  latitude: number | null;
  longitude: number | null;
}

const SIZE_ATTRIBUTE_KEYS = ["talla", "talle", "size"];
const COLOR_ATTRIBUTE_KEYS = ["color"];

/**
 * Looks up a value in a free-form attributes object by a list of candidate
 * keys, matching case-insensitively. Returns "-" when the attributes object
 * is missing/empty or none of the candidate keys are present.
 */
function findAttributeValue(
  attributes: Record<string, string> | null | undefined,
  candidateKeys: string[],
): string {
  if (!attributes) return "-";

  const entries = Object.entries(attributes);
  for (const candidateKey of candidateKeys) {
    const match = entries.find(
      ([key]) => key.trim().toLowerCase() === candidateKey,
    );
    if (match !== undefined && match[1] !== undefined) return match[1];
  }

  return "-";
}

/**
 * Extracts Talla/Color from an order item's free-form `attributes`.
 * Orders imported from Shopify typically don't populate `attributes`,
 * so both values fall back to "-" — known/accepted data limitation.
 */
export function extractSizeAndColor(
  attributes: Record<string, string> | null | undefined,
): { size: string; color: string } {
  return {
    size: findAttributeValue(attributes, SIZE_ATTRIBUTE_KEYS),
    color: findAttributeValue(attributes, COLOR_ATTRIBUTE_KEYS),
  };
}

function buildRowsForOrder(order: OrderResponseDto): DetailedSaleExportRow[] {
  const approvedPayments = (order.payments || []).filter(
    (p) => p.status === "PAID",
  );
  const advancePayment = approvedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const total = Number(order.grandTotal) || 0;
  const pendingPayment = Math.max(0, total - advancePayment);
  const paymentMethod =
    order.payments && order.payments.length > 0
      ? order.payments[0].paymentMethod
      : "N/A";
  const date = new Date(order.created_at).toLocaleDateString("es-PE");

  const items: OrderItemResponseDto[] = order.items || [];

  return items.map((item) => {
    const { size, color } = extractSizeAndColor(item.attributes);

    return {
      orderNumber: order.orderNumber,
      date,
      clientName: order.customer?.fullName || "-",
      phoneNumber: order.customer?.phoneNumber || "-",
      documentType: order.customer?.documentType || "-",
      documentNumber: order.customer?.documentNumber || "-",
      province: order.customer?.province || "-",
      city: order.customer?.city || "-",
      district: order.customer?.district || "-",
      productName: item.productName,
      size,
      color,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice) || 0,
      total,
      advancePayment,
      pendingPayment,
      status: order.status,
      salesRegion: order.salesRegion || "-",
      zone: order.customer?.reference || "-",
      address: order.customer?.address || "-",
      paymentMethod,
      deliveryType: order.deliveryType || "-",
      courier: order.courier || "-",
      sellerName: order.sellerName || "-",
      guideNumber: order.guideNumber || "-",
      metaId: order.metaPubliId || "-",
      mapsLink: order.customer?.googleMapsUrl || "-",
      latitude: order.customer?.latitude ?? null,
      longitude: order.customer?.longitude ?? null,
    };
  });
}

/**
 * Flattens a list of orders into 1 row per product/variant (`order.items[]`),
 * repeating the order's header data (client, dates, location, etc.) in every
 * row. A pedido with N items produces N rows.
 */
export function buildDetailedSalesExportRows(
  orders: OrderResponseDto[],
): DetailedSaleExportRow[] {
  return orders.flatMap(buildRowsForOrder);
}

/**
 * Writes the detailed (1 row per product/variant) sales report to an XLSX
 * file and triggers the browser download.
 */
export function exportDetailedSalesToExcel(
  rows: DetailedSaleExportRow[],
  filenamePrefix: string,
): void {
  if (!rows || rows.length === 0) {
    return;
  }

  const exportData = rows.map((r, index) => ({
    "N°": index + 1,
    Pedido: r.orderNumber,
    Cliente: r.clientName,
    Celular: r.phoneNumber,
    Fecha: r.date,
    "Producto detalle": r.productName,
    Talla: r.size,
    Color: r.color,
    Cantidad: r.quantity,
    Precio: r.unitPrice.toFixed(2),
    Total: r.total.toFixed(2),
    Adelanto: r.advancePayment.toFixed(2),
    "Por Cobrar": r.pendingPayment.toFixed(2),
    Estado: r.status,
    Región: r.salesRegion,
    Provincia: r.province,
    Ciudad: r.city,
    Distrito: r.district,
    Zona: r.zone,
    Dirección: r.address,
    "Método Pago": r.paymentMethod,
    "Tipo Entrega": r.deliveryType,
    Vendedor: r.sellerName,
    Courier: r.courier,
    "N° Guía": r.guideNumber,
    "Tipo Doc": r.documentType,
    "N° Documento": r.documentNumber,
    "Meta ID": r.metaId,
    "LINK MAPS": r.mapsLink,
    Latitud: r.latitude ?? "-",
    Longitud: r.longitude ?? "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas Detallado");

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
