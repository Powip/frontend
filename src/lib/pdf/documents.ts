import {
  formatDay,
  formatMoney,
  lineLabel,
  paymentText,
  PURCHASE_STATUS_LABEL,
  RECEIPT_TYPES,
  RETURN_STATUS_LABEL,
  roundTo,
} from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { periodLabel } from "@/lib/reports/periods";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import type { PurchaseOrder, PurchaseOrderLine, SupplierReturn } from "@/services/purchasesService";
import type { PeriodCloseDetail } from "@/services/inventoryReportsService";
import type { PdfDocSpec } from "./document";

// FEAT-24 H10-D4 — documentos con el encabezado común: orden de compra,
// devolución a proveedor y cierre mensual. Sin permiso de costos la API omite
// los montos: se imprime «••••». Funciones puras.

const receiptLabel = (value: string | null) => RECEIPT_TYPES.find((type) => type.value === value)?.label ?? value ?? "—";

/** Subtotal sin IGV de una línea; `undefined` si el rol no ve costos. */
function lineNet(line: PurchaseOrderLine): number | null | undefined {
  if (!("unitCostNet" in line)) return undefined;
  if (line.unitCostNet === null || line.unitCostNet === undefined) return null;
  return roundTo(line.unitCostNet * line.quantity, 2);
}

function purchaseUnit(line: PurchaseOrderLine): string {
  if (line.purchaseUnit && line.purchaseFactor > 1) return `${line.purchaseQuantity} ${line.purchaseUnit} × ${line.purchaseFactor}`;
  return "unidades";
}

export function purchaseOrderPdfSpec(order: PurchaseOrder, options: { warehouseName?: string } = {}): PdfDocSpec {
  const document = [receiptLabel(order.receiptType), order.document].filter((part) => part && part !== "—").join(" ");
  return {
    title: order.origin === "direct" ? "Compra directa" : "Orden de compra",
    number: order.number,
    date: formatDay(order.purchaseDate ?? order.orderedAt ?? order.createdAt),
    meta: [
      ["Proveedor", order.supplierName ?? "—"],
      ["Estado", PURCHASE_STATUS_LABEL[order.status] ?? order.status],
      ["Entregar en", options.warehouseName ?? "—"],
      ["Comprobante", document || "—"],
      ["Pago", paymentText(order)],
      ["Precios", order.pricesIncludeIgv ? "Con IGV" : "Sin IGV"],
    ],
    tables: [
      {
        head: ["SKU", "Producto", "Cantidad", "Unidad", "Recibido", "Costo unit. sin IGV", "Subtotal"],
        rows: order.lines.map((line) => [
          line.sku,
          lineLabel(line),
          String(line.quantity),
          purchaseUnit(line),
          String(line.receivedQuantity),
          formatMoney(line.unitCostNet, 4),
          formatMoney(lineNet(line)),
        ]),
        align: ["left", "left", "right", "left", "right", "right", "right"],
      },
    ],
    foot: [
      ["Subtotal sin IGV", formatMoney(order.subtotal)],
      ["IGV", formatMoney(order.igvAmount)],
      ["Gastos (en el costo)", formatMoney(order.expenses)],
      ["Total", formatMoney(order.total)],
    ],
    note: [order.notes ? `Notas: ${order.notes}` : null, order.status === "ANULADA" ? `Anulada: ${order.cancelReason || "sin motivo"}` : null].filter(Boolean).join(" · ") || undefined,
    signatures: ["Elaborado por", "Aprobado por", "Proveedor (conformidad)"],
    fileName: order.number,
  };
}

export function supplierReturnPdfSpec(item: SupplierReturn, options: { warehouseName?: string } = {}): PdfDocSpec {
  return {
    title: "Devolución a proveedor",
    number: item.number,
    date: formatDay(item.sentAt ?? item.createdAt),
    meta: [
      ["Proveedor", item.supplierName ?? "—"],
      ["Compra", item.purchaseOrderNumber ?? "—"],
      ["Sale de", options.warehouseName ?? "—"],
      ["Estado", RETURN_STATUS_LABEL[item.status] ?? item.status],
      ["Nota de crédito", item.creditNoteNumber || "Pendiente"],
      ["Motivo", item.reason || "—"],
    ],
    tables: [
      {
        head: ["SKU", "Producto", "Cantidad", "Costo unit. sin IGV", "Subtotal"],
        rows: item.lines.map((line) => {
          // Sin permiso no viene ningún costo («••••»); una línea anterior a H3 no tiene costo («—»).
          const masked = !("unitCostNet" in line) && !("unitCost" in line);
          const unit = masked ? undefined : (line.unitCostNet ?? line.unitCost ?? null);
          const subtotal = typeof unit === "number" ? roundTo(unit * line.quantity, 2) : unit;
          return [line.sku ?? "—", line.productName ?? "Producto", String(line.quantity), formatMoney(unit, 4), formatMoney(subtotal)];
        }),
        align: ["left", "left", "right", "right", "right"],
      },
    ],
    foot: [
      ["Subtotal sin IGV", formatMoney(item.subtotal)],
      ["IGV", formatMoney(item.igvAmount)],
      ["Total", formatMoney(item.total)],
    ],
    note: item.status === "anulada" ? `Anulada${item.cancelReason ? `: ${item.cancelReason}` : ""}` : undefined,
    signatures: ["Entrega", "Recibe (proveedor)"],
    fileName: item.number,
  };
}

export function periodClosePdfSpec(detail: PeriodCloseDetail): PdfDocSpec {
  const hasValue = "totalValue" in detail;
  const reopened = detail.status === "reabierto";
  return {
    title: "Inventario al cierre",
    number: periodLabel(detail.period),
    date: detail.lastDay ? formatDay(detail.lastDay) : undefined,
    meta: [
      ["Estado", reopened ? "Reabierto" : "Cerrado"],
      ["Cerrado el", detail.closedAt ? formatPeruDateTime(detail.closedAt) : "—"],
      ["Por", detail.closedByName || detail.closedBy || "—"],
      ["Variantes", String(detail.itemsCount)],
      ["Unidades", String(detail.units)],
      ["Valor del inventario", hasValue ? formatMoney(detail.totalValue) : "••••"],
      ...(detail.uncostedItems ? ([["Sin costo", `${detail.uncostedItems} variantes · ${detail.uncostedUnits} und`]] as Array<[string, string]>) : []),
      ...(reopened ? ([["Reabierto", `${detail.reopenedByName || detail.reopenedBy || "—"}: ${detail.reopenReason || "sin motivo"}`]] as Array<[string, string]>) : []),
    ],
    tables: [
      {
        head: ["Almacén", "SKU", "Producto", "Físico", "Reservado", "Costo prom.", "Valor"],
        rows: detail.items.map((item) => [
          item.inventoryName ?? "—",
          item.sku ?? "—",
          [item.productName || "Variante fuera del catálogo", formatVariantLabel(item.attributes)].filter(Boolean).join(" · "),
          String(item.physical),
          String(item.reserved),
          formatMoney("averageCost" in item ? item.averageCost ?? null : undefined, 4),
          formatMoney("value" in item ? item.value ?? null : undefined),
        ]),
        align: ["left", "left", "left", "right", "right", "right", "right"],
      },
    ],
    foot: [["Valor del inventario", hasValue ? formatMoney(detail.totalValue) : "••••"]],
    note: "Foto del stock y del valor al último instante del mes. Lo sin costo no suma al valor.",
    signatures: ["Administrador", "Contador"],
    fileName: `cierre-${detail.period}`,
  };
}
