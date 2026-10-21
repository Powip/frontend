import type { InventoryMovement } from "@/services/inventoryMovementService";
import { ADJUSTMENT_REASON_LABELS, type AdjustmentReason } from "@/services/stockAdjustmentService";

// FEAT-24 H0 — historial legible: cada motivo con nombre, el efecto en físico
// y en reservado por separado, y el documento (ORD-/COM-) en vez del UUID.
export interface MovementView {
  label: string;
  detail: string | null;
  physicalDelta: number | null;
  reservedDelta: number | null;
  documentNumber: string | null;
  orderId: string | null;
}

const EXACT: Record<string, string> = {
  CREATE_ITEM: "Alta del producto",
  STOCK_ADDITION: "Ajuste (sin motivo)",
  STOCK_REDUCTION: "Ajuste (sin motivo)",
  SALE_RESERVATION: "Reserva de venta",
  SALE_CONFIRMED: "Venta entregada",
  SALE_CANCELED: "Reserva liberada por venta cancelada",
  SALE_CANCELLED_RESTORE: "Devolución por venta cancelada",
  ORDER_UPDATE_RESERVATION: "Reserva por pedido modificado",
  ORDER_UPDATE_RELEASE: "Liberación por pedido modificado",
  EXTERNAL_SYNC_CREATE: "Alta desde Shopify",
  EXTERNAL_SYNC_ADJUST: "Sincronización con Shopify",
};

// El orden importa: los prefijos largos antes que los cortos.
const PREFIXED: Array<[string, string]> = [
  ["PURCHASE_EDIT_REVERT - ", "Reversión por edición de compra"],
  ["PURCHASE_EDIT - ", "Edición de compra"],
  ["PURCHASE_CANCELLED - ", "Compra anulada"],
  ["PURCHASE - ", "Compra"],
  ["AUDIT_CORRECTION", "Corrección de cantidad inválida"],
];

const ORDER_EVENTS: Record<string, string> = {
  "order.created": "Reserva por pedido",
  "order.updated": "Pedido modificado",
  "order.cancelled": "Reserva liberada por pedido cancelado",
  "order.delivered": "Pedido entregado",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT = /^(ORD|COM)-/;

function deltasByType(type: string, quantity: number): Pick<MovementView, "physicalDelta" | "reservedDelta"> {
  switch (type) {
    case "IN": return { physicalDelta: quantity, reservedDelta: null };
    case "OUT": return { physicalDelta: -quantity, reservedDelta: null };
    case "RESERVED": return { physicalDelta: null, reservedDelta: quantity };
    case "RELEASED": return { physicalDelta: null, reservedDelta: -quantity };
    case "COMMITTED": return { physicalDelta: -quantity, reservedDelta: null };
    default: return { physicalDelta: null, reservedDelta: null };
  }
}

export function describeMovement(movement: Pick<InventoryMovement, "type" | "quantity" | "reason" | "referenceId">): MovementView {
  const reason = movement.reason ?? "";
  const reference = movement.referenceId;
  let label = "Otro movimiento";
  let detail: string | null = null;
  let deltas = deltasByType(movement.type, movement.quantity);
  let documentNumber = reference && DOCUMENT.test(reference) ? reference : null;
  let orderId: string | null = null;

  const adjustment = reason.match(/^ADJUSTMENT_(IN|OUT) - ([a-z_]+)(?: - ([\s\S]*))?$/);
  const reconcile = reason.match(/^RECONCILE_(MERGE|LINK)_(IN|OUT) reserved=(\d+)/);
  const orderEvent = reason.match(/^(order\.[a-z]+):\d+$/);
  const prefixed = PREFIXED.find(([prefix]) => reason.startsWith(prefix));

  if (adjustment) {
    label = `Ajuste · ${ADJUSTMENT_REASON_LABELS[adjustment[2] as AdjustmentReason] ?? adjustment[2]}`;
    detail = adjustment[3]?.trim() || null;
  } else if (reconcile) {
    const sign = reconcile[2] === "IN" ? 1 : -1;
    const reserved = Number(reconcile[3]);
    label = `${reconcile[1] === "MERGE" ? "Unificación" : "Vinculación"} · ${reconcile[2] === "IN" ? "entra" : "sale"}`;
    deltas = { physicalDelta: sign * movement.quantity, reservedDelta: reserved > 0 ? sign * reserved : null };
  } else if (orderEvent && ORDER_EVENTS[orderEvent[1]]) {
    label = ORDER_EVENTS[orderEvent[1]];
  } else if (EXACT[reason]) {
    label = EXACT[reason];
  } else if (prefixed) {
    label = prefixed[1];
    const tail = reason.slice(prefixed[0].length).trim();
    if (!documentNumber && DOCUMENT.test(tail)) documentNumber = tail;
  } else if (reason.startsWith("SHRINKAGE - ")) {
    label = `Merma (${reason.slice("SHRINKAGE - ".length)})`;
  } else if (reason.startsWith("UNIT_TRANSFER_OUT - ")) {
    label = `Transferencia de IMEI/series · Salida (${reason.slice("UNIT_TRANSFER_OUT - ".length)})`;
  } else if (reason.startsWith("UNIT_TRANSFER_IN - ")) {
    label = `Transferencia de IMEI/series · Ingreso (${reason.slice("UNIT_TRANSFER_IN - ".length)})`;
  }

  if (reference && UUID.test(reference) && (orderEvent || reason.startsWith("ORDER_UPDATE_") || reason.startsWith("SALE_"))) {
    orderId = reference;
  }
  return { label, detail, ...deltas, documentNumber, orderId };
}

const PERU = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Las fechas se guardan en UTC; se muestran siempre en hora de Perú, sin importar la zona del navegador. */
export function formatPeruDateTime(iso: string): string {
  const parts = Object.fromEntries(PERU.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
}
