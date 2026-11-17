// FEAT-24 H2-F — lógica pura del stock de los pedidos (contrato H2-C de ms-ventas):
// estado de stock del pedido, bandejas «Sin stock» / «Sin reserva», picking y
// permisos. Sin React ni HTTP para poder probarla sola.

export const ORDER_STOCK_STATES = [
  "reserved",
  "sin_stock",
  "sin_reserva",
  "por_vincular",
  "dispatched",
  "delivered",
  "released",
  "returned",
] as const;

export type OrderStockState = (typeof ORDER_STOCK_STATES)[number];

export type StockStateTone = "ok" | "danger" | "warning" | "info" | "neutral";

export interface StockStateInfo {
  label: string;
  tone: StockStateTone;
  hint: string;
}

const STOCK_STATE_INFO: Record<OrderStockState, StockStateInfo> = {
  reserved: { label: "Reservado", tone: "ok", hint: "El stock del pedido está apartado en su almacén." },
  sin_stock: {
    label: "Sin stock",
    tone: "danger",
    hint: "No había unidades para reservar. Lo gestiona Atención al cliente en Inventario › Pedidos sin stock.",
  },
  sin_reserva: {
    label: "Sin reserva",
    tone: "warning",
    hint: "La reserva se liberó o no se pudo hacer: hay que volver a reservar.",
  },
  por_vincular: {
    label: "Por vincular",
    tone: "warning",
    hint: "Tiene productos sin vincular al catálogo: no se puede reservar hasta vincularlos.",
  },
  dispatched: { label: "Despachado", tone: "info", hint: "El stock salió del almacén con el pedido." },
  delivered: { label: "Entregado", tone: "neutral", hint: "El pedido se entregó." },
  released: { label: "Liberado", tone: "neutral", hint: "La reserva se liberó y el stock volvió a estar disponible." },
  returned: {
    label: "Devuelto",
    tone: "info",
    hint: "Volvió del courier: se recibe en Inventario › Recepciones.",
  },
};

export function isOrderStockState(value: unknown): value is OrderStockState {
  return typeof value === "string" && (ORDER_STOCK_STATES as readonly string[]).includes(value);
}

/** `null` cuando el pedido no trae estado de stock (o trae uno que no conocemos). */
export function stockStateInfo(value: unknown): StockStateInfo | null {
  return isOrderStockState(value) ? STOCK_STATE_INFO[value] : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días completos desde `since`; `null` si no hay fecha válida. */
export function daysWaiting(since: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!since) return null;
  const start = since instanceof Date ? since.getTime() : Date.parse(since);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((now.getTime() - start) / DAY_MS));
}

export function daysWaitingLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Hoy";
  return days === 1 ? "1 día" : `${days} días`;
}

/* ---------------------------------------------------------------------------
   Errores de la API
--------------------------------------------------------------------------- */

export function apiErrorStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim() !== "");
    if (parts.length > 0) return parts.map((part) => part.trim()).join(". ");
  }
  if (typeof message === "string" && message.trim() !== "") return message.trim();
  return fallback;
}

export const DISPATCH_PENDING_MESSAGE =
  "El despacho quedó pendiente: se reintenta solo. No hace falta volver a completarlo.";

/** Mensaje al fallar «Completar»: 409 = lo que dice el servidor (p. ej. el faltante); 503 = quedó pendiente. */
export function pickingCompleteErrorMessage(error: unknown): string {
  const status = apiErrorStatus(error);
  if (status === 503) return DISPATCH_PENDING_MESSAGE;
  if (status === 403) return apiErrorMessage(error, "No tienes permiso para despachar pedidos.");
  return apiErrorMessage(error, "No se pudo completar el picking. Inténtalo de nuevo.");
}

/* ---------------------------------------------------------------------------
   Picking
--------------------------------------------------------------------------- */

export interface PickingLineLike {
  itemId: string;
  quantity: number;
  picked: number;
  pending: number;
  linked: boolean;
}

export interface PickingViewLike {
  pickingRequired: boolean | null;
  complete: boolean;
  lines: PickingLineLike[];
}

export function pickingProgress(view: PickingViewLike): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of view.lines) {
    const quantity = Math.max(0, line.quantity);
    total += quantity;
    done += quantity - Math.min(quantity, Math.max(0, line.pending));
  }
  return { done, total };
}

/**
 * «Confirmar sin escanear» solo si la empresa no exige picking. `null` = el servidor no pudo leer la regla:
 * se ofrece y, si la empresa lo exige, el servidor responde 403 y se oculta (`forbidden`).
 */
export function canConfirmWithoutScan(view: PickingViewLike, forbidden: boolean): boolean {
  return view.pickingRequired !== true && !forbidden;
}

/**
 * El escaneo y el completar devuelven `pickingRequired: null` (no vuelven a leer la regla): se conserva la que
 * trajo la vista inicial para no volver a ofrecer «Confirmar sin escanear» a quien la empresa se lo prohíbe.
 */
export function mergePickingView<T extends PickingViewLike>(previous: T | undefined, next: T): T {
  if (next.pickingRequired !== null || !previous) return next;
  return { ...next, pickingRequired: previous.pickingRequired };
}

/** Línea que sumó unidades entre dos vistas (la que acaba de tomar el escaneo). */
export function pickedLine<L extends PickingLineLike>(previous: { lines: L[] } | undefined, next: { lines: L[] }): L | null {
  const before = new Map((previous?.lines ?? []).map((line) => [line.itemId, line.picked]));
  return next.lines.find((line) => line.picked > (before.get(line.itemId) ?? 0)) ?? null;
}

/** Estados en los que el servidor acepta picking (antes del despacho). */
export const PICKABLE_ORDER_STATUSES = ["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO"] as const;

/* ---------------------------------------------------------------------------
   Permisos (los mismos que exige ms-ventas; SUPERADMIN ya pasa en hasPermission)
--------------------------------------------------------------------------- */

export const OPERATIONS_STOCK_PERMISSIONS = ["MANAGE_OPERATIONS", "UPDATE_DELIVERY_STATUS"] as const;
export const CUSTOMER_STOCK_PERMISSIONS = ["MANAGE_CUSTOMER_SERVICE", "CONFIRM_SALE", "EDIT_SALE", "MANAGE_OPERATIONS"] as const;
export const STOCK_WAREHOUSE_PERMISSION = "MANAGE_OPERATIONS";

export interface OrderStockAccess {
  /** Bandeja «Sin stock» y su gestión (cambio, espera, anular, re-reservar). */
  customer: boolean;
  /** Picking, «Devuelto por courier», liberar reserva. */
  operations: boolean;
  /** Bandeja «Sin reserva» (verla). */
  sinReserva: boolean;
  /** Cambiar el almacén de la reserva. */
  warehouse: boolean;
}

export function orderStockAccess(hasPermission: (permission: string) => boolean): OrderStockAccess {
  const customer = CUSTOMER_STOCK_PERMISSIONS.some((permission) => hasPermission(permission));
  const operations = OPERATIONS_STOCK_PERMISSIONS.some((permission) => hasPermission(permission));
  return {
    customer,
    operations,
    sinReserva: customer || operations,
    warehouse: hasPermission(STOCK_WAREHOUSE_PERMISSION),
  };
}

/* ---------------------------------------------------------------------------
   Cambiar el almacén de la reserva
--------------------------------------------------------------------------- */

/** El servidor rechaza el cambio desde En envío (el pedido ya salió del almacén). */
const SHIPPED_STATUSES = ["EN_ENVIO", "DESPACHADO", "ENTREGADO", "ANULADO"];

export interface WarehouseChangeOrder {
  status?: string | null;
  stockState?: string | null;
  externalSource?: string | null;
}

/** Motivo por el que no se ofrece cambiar el almacén; `null` = se puede. */
export function warehouseChangeBlockReason(order: WarehouseChangeOrder): string | null {
  const status = (order.status ?? "").toUpperCase();
  if (SHIPPED_STATUSES.includes(status) || order.stockState === "dispatched" || order.stockState === "delivered")
    return "El almacén solo se puede cambiar antes del despacho.";
  if (order.externalSource === "POWIP_LIVE") return "Los pedidos de Live conservan su almacén.";
  return null;
}
