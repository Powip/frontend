import { ADJUSTMENT_REASON_LABELS, type AdjustmentReason } from "@/services/stockAdjustmentService";
import { KARDEX_TYPE_LABELS, LEDGER_FIRST_TYPES } from "@/lib/reports/kardexTypes";

// FEAT-24 H0 — historial legible: cada motivo con nombre, el efecto en físico
// y en reservado por separado, y el documento (ORD-/COM-/TRA-) en vez del UUID.
// FEAT-24 H1-B — las filas del libro de stock traen el efecto exacto y el saldo resultante;
// las viejas (campos en null o ausentes) siguen calculándose con `type` y `quantity`.
// FEAT-24 H10 — las filas vienen del kardex de la fachada (`GET /inventory-reports/kardex`); los tipos
// nuevos del libro (compra, despacho, traslado, ajuste, merma, cambio…) se nombran por su tipo.

/** Lo que el historial necesita de un movimiento (fila del kardex o fila vieja). */
export interface MovementLike {
  type: string;
  quantity: number;
  reason: string | null;
  referenceId: string | null;
  physicalDelta?: number | null;
  reservedDelta?: number | null;
  physicalAfter?: number | null;
  reservedAfter?: number | null;
  referenceNumber?: string | null;
}
export interface MovementView {
  label: string;
  detail: string | null;
  /** Efecto en el físico; null cuando el movimiento no lo toca (en filas del libro, delta 0). */
  physicalDelta: number | null;
  reservedDelta: number | null;
  /** Saldo resultante; solo en filas del libro y solo del saldo que el movimiento cambió. */
  physicalAfter: number | null;
  reservedAfter: number | null;
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
  SHRINKAGE: "Merma",
  SALE: "Venta",
  RECONCILE_DISCARD: "Unificación · stock descartado",
  RECONCILE_RESERVE_FLOOR: "Unificación · se completa hasta lo reservado",
  UNIT_REGULARIZATION: "Activación de IMEI/series",
  RECONCILE_NEGATIVE_RESET: "Corrección de negativo al unificar",
};

// El orden importa: los prefijos largos antes que los cortos.
const PREFIXED: Array<[string, string]> = [
  ["PURCHASE_EDIT_REVERT - ", "Reversión por edición de compra"],
  ["PURCHASE_EDIT - ", "Edición de compra"],
  ["PURCHASE_CANCELLED - ", "Compra anulada"],
  ["PURCHASE - ", "Compra"],
  ["AUDIT_CORRECTION", "Corrección de cantidad inválida"],
];

// Tipos propios del libro de stock. SALDO_INICIAL y ANULACION (H1-B) solo valen si el motivo no tiene
// nombre; los de LEDGER_FIRST_TYPES (H2 en adelante) mandan sobre el motivo.
const TYPE_LABELS: Record<string, string> = {
  SALDO_INICIAL: KARDEX_TYPE_LABELS.SALDO_INICIAL,
  ANULACION: KARDEX_TYPE_LABELS.ANULACION,
};

const ORDER_EVENTS: Record<string, string> = {
  "order.created": "Reserva por pedido",
  "order.updated": "Pedido modificado",
  "order.cancelled": "Reserva liberada por pedido cancelado",
  "order.delivered": "Pedido entregado",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// FEAT-24 H10: también OC-, REC- y DEV- (compras, recepciones y devoluciones a proveedor de H3).
const DOCUMENT = /^(ORD|COM|TRA|OC|REC|DEV)-/;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

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

export function describeMovement(movement: MovementLike): MovementView {
  const reason = movement.reason ?? "";
  const reference = movement.referenceId;
  let label: string | null = null;
  let detail: string | null = null;
  let deltas = deltasByType(movement.type, movement.quantity);
  // El número legible que guarda el libro manda; un UUID nunca se muestra como referencia.
  const stored = movement.referenceNumber?.trim();
  let documentNumber = stored && !UUID.test(stored) ? stored : reference && DOCUMENT.test(reference) ? reference : null;
  let orderId: string | null = null;

  const adjustment = reason.match(/^ADJUSTMENT_(IN|OUT) - ([a-z_]+)(?: - ([\s\S]*))?$/);
  const reconcile = reason.match(/^RECONCILE_(MERGE|LINK)_(IN|OUT) reserved=(\d+)/);
  const reconcileCount = reason.match(/^RECONCILE_COUNT from=(-?\d+) to=(-?\d+)$/);
  // ":UNASSIGNED": reserva de IMEI/series que todavía no tiene la unidad elegida.
  const orderEvent = reason.match(/^(order\.[a-z]+):\d+(:UNASSIGNED)?$/);
  const prefixed = PREFIXED.find(([prefix]) => reason.startsWith(prefix));

  if (adjustment) {
    label = `Ajuste · ${ADJUSTMENT_REASON_LABELS[adjustment[2] as AdjustmentReason] ?? adjustment[2]}`;
    detail = adjustment[3]?.trim() || null;
  } else if (reconcile) {
    const sign = reconcile[2] === "IN" ? 1 : -1;
    const reserved = Number(reconcile[3]);
    label = `${reconcile[1] === "MERGE" ? "Unificación" : "Vinculación"} · ${reconcile[2] === "IN" ? "entra" : "sale"}`;
    deltas = { physicalDelta: sign * movement.quantity, reservedDelta: reserved > 0 ? sign * reserved : null };
  } else if (reconcileCount) {
    label = "Unificación · conteo";
    detail = `de ${reconcileCount[1]} a ${reconcileCount[2]}`;
  } else if (orderEvent && ORDER_EVENTS[orderEvent[1]]) {
    label = orderEvent[2] ? `${ORDER_EVENTS[orderEvent[1]]} · sin unidad asignada` : ORDER_EVENTS[orderEvent[1]];
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

  // Fila del libro: trae los dos deltas exactos (el 0 es «no aplica») y el saldo que quedó.
  let physicalAfter: number | null = null;
  let reservedAfter: number | null = null;
  if (isNumber(movement.physicalDelta) && isNumber(movement.reservedDelta)) {
    deltas = { physicalDelta: movement.physicalDelta || null, reservedDelta: movement.reservedDelta || null };
    if (deltas.physicalDelta !== null && isNumber(movement.physicalAfter)) physicalAfter = movement.physicalAfter;
    if (deltas.reservedDelta !== null && isNumber(movement.reservedAfter)) reservedAfter = movement.reservedAfter;
  }

  if (LEDGER_FIRST_TYPES.has(movement.type)) {
    // El evento del pedido (order.cancelled, …) no describe una fila del libro: se omite del detalle.
    const fromReason = orderEvent ? null : label;
    return {
      label: KARDEX_TYPE_LABELS[movement.type],
      detail: [fromReason, detail].filter(Boolean).join(" · ") || null,
      ...deltas,
      physicalAfter,
      reservedAfter,
      documentNumber,
      orderId,
    };
  }
  return { label: label ?? TYPE_LABELS[movement.type] ?? "Otro movimiento", detail, ...deltas, physicalAfter, reservedAfter, documentNumber, orderId };
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
