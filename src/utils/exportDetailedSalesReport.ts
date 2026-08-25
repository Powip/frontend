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
  possibleDuplicate: boolean;
  relatedOrders: string;
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
 * Short "talla" tokens used across Powip stores. No shared enum/list of
 * sizes exists elsewhere in the frontend — product attribute values are
 * entered freely per-product (`app/productos/create-product/create-product.tsx`)
 * — so this is a best-effort set built from the real product names sampled
 * during the FEAT-15 investigation.
 * Anything that doesn't match this list is assumed to be a color.
 */
const KNOWN_SIZE_TOKENS = new Set([
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "2XL",
  "3XL",
  "STD",
  "UNICA",
  "ÚNICA",
  "UNITALLA",
]);

/**
 * Matches the "<name> - <segment1> / <segment2>" pattern some product names
 * carry embedded (mostly Shopify imports whose `attributes` isn't
 * populated), e.g. "CHOMPA OVEJERA KUNCA - S / Arena" or
 * "CHOMPA OVEJERA UNISEX - Negro / M". The greedy `.*` before the literal
 * "-" makes sure the LAST " - seg1 / seg2" occurrence in the string is the
 * one captured, in case the product name itself contains a dash.
 */
const PRODUCT_NAME_SIZE_COLOR_PATTERN = /^.*-\s*([^/]+?)\s*\/\s*([^/]+?)\s*$/;

function normalizeSizeToken(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Attempts to parse Talla/Color embedded in the product name, as a fallback
 * for orders whose `item.attributes` doesn't carry them. Returns null when
 * the name doesn't match the expected pattern, or when neither segment
 * resembles a known talla token (so we can't tell which segment is which).
 */
function parseSizeAndColorFromProductName(
  productName: string | null | undefined,
): { size: string; color: string } | null {
  if (!productName) return null;

  const match = productName.match(PRODUCT_NAME_SIZE_COLOR_PATTERN);
  if (!match) return null;

  const first = match[1].trim();
  const second = match[2].trim();
  if (!first || !second) return null;

  const firstIsSize = KNOWN_SIZE_TOKENS.has(normalizeSizeToken(first));
  const secondIsSize = KNOWN_SIZE_TOKENS.has(normalizeSizeToken(second));

  if (firstIsSize && !secondIsSize) {
    return { size: first, color: second };
  }
  if (secondIsSize && !firstIsSize) {
    return { size: second, color: first };
  }
  if (firstIsSize && secondIsSize) {
    return { size: first, color: second };
  }

  return null;
}

/**
 * Extracts Talla/Color from an order item's free-form `attributes`.
 * Orders imported from Shopify typically don't populate `attributes`,
 * so both values fall back to "-" — known/accepted data limitation.
 */
export function extractSizeAndColor(
  attributes: Record<string, string> | null | undefined,
  productName?: string | null,
): { size: string; color: string } {
  const size = findAttributeValue(attributes, SIZE_ATTRIBUTE_KEYS);
  const color = findAttributeValue(attributes, COLOR_ATTRIBUTE_KEYS);

  if (size === "-" && color === "-") {
    const parsedFromName = parseSizeAndColorFromProductName(productName);
    if (parsedFromName) return parsedFromName;
  }

  return { size, color };
}

/**
 * Normalizes a Peru phone number to digits-only with a guaranteed "51"
 * country prefix, so the same number matches across orders regardless of
 * how it was entered (e.g. "+51987654321" vs "987654321").
 */
function normalizePhoneNumber(phoneNumber: string | null | undefined): string {
  let cleanPhone = (phoneNumber || "").replace(/\D/g, "");
  if (!cleanPhone) return "";

  if (!cleanPhone.startsWith("51")) {
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.substring(1);
    }
    cleanPhone = `51${cleanPhone}`;
  }

  return cleanPhone;
}

function normalizeProductName(productName: string | null | undefined): string {
  return (productName || "").trim().toLowerCase();
}

const DUPLICATE_DETECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

function appendRelatedOrder(
  relatedOrderNumbersByOrderId: Map<string, string[]>,
  orderId: string,
  relatedOrderNumber: string,
): void {
  const existing = relatedOrderNumbersByOrderId.get(orderId);
  if (existing) {
    existing.push(relatedOrderNumber);
  } else {
    relatedOrderNumbersByOrderId.set(orderId, [relatedOrderNumber]);
  }
}

/**
 * Detects pairs of orders that look like the same customer submitted the
 * COD form more than once. Two orders are flagged as a possible duplicate
 * of each other when ALL of:
 *   1. Same `customer.phoneNumber` (normalized: digits only + "51" country prefix).
 *   2. At least 1 `item.productName` in common (normalized: trim + lowercase).
 *   3. `created_at` difference under 24h.
 *
 * @returns a Map of `order.id` -> the `orderNumber`s of the OTHER orders it
 * matched with. Orders with no match are absent from the map.
 */
export function detectPossibleDuplicates(
  orders: OrderResponseDto[],
): Map<string, string[]> {
  const relatedOrderNumbersByOrderId = new Map<string, string[]>();

  const normalizedOrders = orders.map((order) => ({
    order,
    phone: normalizePhoneNumber(order.customer?.phoneNumber),
    productNames: new Set(
      (order.items || []).map((item) => normalizeProductName(item.productName)),
    ),
    createdAtMs: new Date(order.created_at).getTime(),
  }));

  for (let i = 0; i < normalizedOrders.length; i++) {
    for (let j = i + 1; j < normalizedOrders.length; j++) {
      const a = normalizedOrders[i];
      const b = normalizedOrders[j];

      if (!a.phone || a.phone !== b.phone) continue;

      const timeDiffMs = Math.abs(a.createdAtMs - b.createdAtMs);
      if (Number.isNaN(timeDiffMs) || timeDiffMs >= DUPLICATE_DETECTION_WINDOW_MS) {
        continue;
      }

      const hasCommonProduct = Array.from(a.productNames).some(
        (name) => name !== "" && b.productNames.has(name),
      );
      if (!hasCommonProduct) continue;

      appendRelatedOrder(relatedOrderNumbersByOrderId, a.order.id, b.order.orderNumber);
      appendRelatedOrder(relatedOrderNumbersByOrderId, b.order.id, a.order.orderNumber);
    }
  }

  return relatedOrderNumbersByOrderId;
}

function buildRowsForOrder(
  order: OrderResponseDto,
  relatedOrderNumbers: string[],
): DetailedSaleExportRow[] {
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
  const possibleDuplicate = relatedOrderNumbers.length > 0;
  const relatedOrders = relatedOrderNumbers.join(", ");

  return items.map((item) => {
    const { size, color } = extractSizeAndColor(item.attributes, item.productName);

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
      possibleDuplicate,
      relatedOrders,
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
  const relatedOrderNumbersByOrderId = detectPossibleDuplicates(orders);
  return orders.flatMap((order) =>
    buildRowsForOrder(order, relatedOrderNumbersByOrderId.get(order.id) || []),
  );
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
    "Posible Duplicado": r.possibleDuplicate ? "Sí" : "No",
    "Pedidos Relacionados": r.relatedOrders,
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
