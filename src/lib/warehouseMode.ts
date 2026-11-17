import { canEditInventory, type RouteAccessUser } from "@/config/permissions.config";
import type { VariantStock } from "@/services/inventoryItems.service";
import {
  completePicking,
  confirmPickingLine,
  getPicking,
  scanPicking,
  type PickingCompletion,
  type PickingView,
} from "@/services/orderStockService";
import type { CatalogVariant, VariantCodeMatch } from "@/services/variantCodesService";
import {
  listReturnReceptions,
  receiveReturnReception,
  type ReceivedReturnLine,
  type ReceiveReturnBody,
  type ReturnReception,
} from "@/services/warehousesService";
import type { ActionHandler, QueuedAction, QueueSession, QueueStatus } from "./offlineQueue";
import { apiErrorStatus, DISPATCH_PENDING_MESSAGE, orderStockAccess, pickingProgress } from "./orderStock";
import { formatVariantLabel } from "./variantAttributes";

// FEAT-24 H6-D — modo almacén (/almacen): quién usa cada pantalla, las acciones
// de la cola sin conexión (cómo se envían y cómo se verifica si ya se aplicaron)
// y la consulta de stock por código. Reutiliza los servicios y la lógica de
// H2-F (picking, recepciones, EAN): no inventa reglas de stock.

/* ---------------------------------------------------------------------------
   Acceso
--------------------------------------------------------------------------- */

/** Rol del almacenero (spec §9), lo crea el script de H6-C en ms-auth. */
export const WAREHOUSE_ROLE = "ALMACEN";

export const isWarehouseRole = (role?: string | null): boolean => role?.trim().toUpperCase() === WAREHOUSE_ROLE;

export interface WarehouseAccess {
  /** Consultar stock: cualquiera con sesión (igual que Inventario). */
  consult: boolean;
  /** Picking y despacho: los permisos que exige ms-ventas (Operaciones o actualizar entregas). */
  picking: boolean;
  /** Recibir devoluciones: quienes editan inventario (Administrador, Operaciones) y el rol Almacén. */
  receiveReturns: boolean;
}

export function warehouseAccess(user: RouteAccessUser | undefined, hasPermission: (permission: string) => boolean): WarehouseAccess {
  return {
    consult: Boolean(user),
    picking: orderStockAccess(hasPermission).operations,
    receiveReturns: canEditInventory(user) || isWarehouseRole(user?.role),
  };
}

/* ---------------------------------------------------------------------------
   Acciones de la cola
--------------------------------------------------------------------------- */

export const WAREHOUSE_ACTION = {
  pickingScan: "picking.scan",
  pickingConfirmLine: "picking.confirm-line",
  pickingComplete: "picking.complete",
  returnReceive: "return.receive",
} as const;

export interface PickingScanPayload {
  orderId: string;
  orderNumber: string;
  code: string;
}

export interface PickingLinePayload {
  orderId: string;
  orderNumber: string;
  itemId: string;
  lineName?: string;
}

export interface PickingCompletePayload {
  orderId: string;
  orderNumber: string;
}

export interface ReturnReceivePayload {
  receptionId: string;
  orderLabel: string;
  body: ReceiveReturnBody;
}

/** Sin respuesta en este tiempo, la acción queda «sin respuesta» y se verifica antes de reenviarla. */
export const WRITE_TIMEOUT_MS = 15_000;

const pickedKey = (orderId: string) => `picked:${orderId}`;
/** Unidades ya tomadas en el pedido (escaneadas o confirmadas). */
export const pickedTotal = (view: PickingView): number => pickingProgress(view).done;

/** Estados en los que el pedido ya salió del almacén. */
const SHIPPED_STATUSES = ["DESPACHADO", "ENTREGADO"];

/**
 * Escanear suma 1 unidad en el servidor: reenviarlo a ciegas podría contar dos veces. Antes del primer envío
 * se guarda cuántas unidades había tomadas; si el envío queda sin respuesta, se vuelve a leer el picking y,
 * si ya hay más, se da por aplicado. (Si otra persona escanea el mismo pedido en ese rato se confunde con
 * el nuestro: es raro y lo resuelve H6-A, que deduplica por `Idempotency-Key`.)
 */
const scanHandler: ActionHandler<PickingScanPayload, PickingView> = {
  async prepare({ orderId }, { memo }) {
    const known = memo.get<number>(pickedKey(orderId));
    if (known !== undefined) return { picked: known };
    return { picked: pickedTotal(await getPicking(orderId)) };
  },
  send: ({ orderId, code }, { idempotencyKey }) => scanPicking(orderId, code, { idempotencyKey, timeoutMs: WRITE_TIMEOUT_MS }),
  async verify({ orderId }, { checkpoint }) {
    const before = (checkpoint as { picked?: unknown } | null)?.picked;
    const view = await getPicking(orderId);
    if (typeof before === "number" && pickedTotal(view) > before) return { applied: true, result: view };
    return { applied: false };
  },
  onApplied({ orderId }, view, { memo }) {
    if (view) memo.set(pickedKey(orderId), pickedTotal(view));
    else memo.delete(pickedKey(orderId));
  },
};

/** Confirmar una línea ya es idempotente en ms-ventas; igual se verifica para no enviar de más. */
const confirmLineHandler: ActionHandler<PickingLinePayload, PickingView> = {
  send: ({ orderId, itemId }, { idempotencyKey }) =>
    confirmPickingLine(orderId, itemId, { idempotencyKey, timeoutMs: WRITE_TIMEOUT_MS }),
  async verify({ orderId, itemId }) {
    const view = await getPicking(orderId);
    const line = view.lines.find((candidate) => candidate.itemId === itemId);
    if (!line) return { conflict: "Esa línea ya no es parte del pedido." };
    return line.pending === 0 ? { applied: true, result: view } : { applied: false };
  },
  onApplied({ orderId }, view, { memo }) {
    if (view) memo.set(pickedKey(orderId), pickedTotal(view));
    else memo.delete(pickedKey(orderId));
  },
};

/**
 * Completar despacha el pedido: reenviarlo después de aplicado responde 409 («el picking es antes del
 * despacho») y lo mandaría a revisar por error. Tras un envío sin respuesta se lee el picking: si ya tiene
 * `completedAt`, se aplicó.
 */
const completeHandler: ActionHandler<PickingCompletePayload, PickingCompletion> = {
  send: ({ orderId }, { idempotencyKey }) => completePicking(orderId, { idempotencyKey, timeoutMs: WRITE_TIMEOUT_MS }),
  // 503: el despacho quedó pendiente y ms-ventas lo reintenta solo; no hay que volver a completarlo.
  appliedOnError: (error) => (apiErrorStatus(error) === 503 ? { message: DISPATCH_PENDING_MESSAGE } : null),
  async verify({ orderId }) {
    const view = await getPicking(orderId);
    if (!view.completedAt) return { applied: false };
    return { applied: true, result: { ...view, dispatched: SHIPPED_STATUSES.includes(String(view.status).toUpperCase()) } };
  },
  onApplied({ orderId }, _result, { memo }) {
    memo.delete(pickedKey(orderId));
  },
};

type LineKey = string;
const lineTotals = (lines: Array<{ variantId: string; result: string; quantity: number }>): Map<LineKey, number> => {
  const totals = new Map<LineKey, number>();
  for (const line of lines) {
    const key = `${line.variantId.toLowerCase()}|${line.result}`;
    totals.set(key, (totals.get(key) ?? 0) + line.quantity);
  }
  return totals;
};

/** ¿La recepción registrada es la misma que queríamos registrar? (mismas cantidades y mismo almacén). */
export function sameReception(
  reception: Pick<ReturnReception, "receivedLines" | "receivedInventoryId" | "inventoryId">,
  body: ReceiveReturnBody,
): boolean {
  const destination = body.inventoryId ?? reception.inventoryId;
  if (reception.receivedInventoryId && body.lines.some((line) => line.result === "reingreso") && reception.receivedInventoryId !== destination)
    return false;
  const registered = lineTotals((reception.receivedLines ?? []) as ReceivedReturnLine[]);
  const wanted = lineTotals(body.lines);
  if (registered.size !== wanted.size) return false;
  for (const [key, quantity] of wanted) if (registered.get(key) !== quantity) return false;
  return true;
}

/**
 * Recibir: tras un envío sin respuesta se busca la devolución entre las recibidas. Si está y coincide, se
 * aplicó; si está con otras cantidades, la recibió otra persona (a revisar); si no está, se reenvía.
 */
const receiveHandler: ActionHandler<ReturnReceivePayload, ReturnReception> = {
  send: ({ receptionId, body }, { idempotencyKey }) =>
    receiveReturnReception(receptionId, body, { idempotencyKey, timeoutMs: WRITE_TIMEOUT_MS }),
  async verify({ receptionId, body }) {
    const reception = (await listReturnReceptions("recibida")).find((candidate) => candidate.id === receptionId);
    if (!reception) return { applied: false };
    if (sameReception(reception, body)) return { applied: true, result: reception };
    const who = reception.receivedByName || reception.receivedBy;
    return {
      conflict: `La devolución ya se recibió con otras cantidades${who ? ` (la registró ${who})` : ""}. Revísala en Inventario › Recepciones.`,
    };
  },
};

export function warehouseActionHandlers(): Record<string, ActionHandler<never, unknown>> {
  return {
    [WAREHOUSE_ACTION.pickingScan]: scanHandler as ActionHandler<never, unknown>,
    [WAREHOUSE_ACTION.pickingConfirmLine]: confirmLineHandler as ActionHandler<never, unknown>,
    [WAREHOUSE_ACTION.pickingComplete]: completeHandler as ActionHandler<never, unknown>,
    [WAREHOUSE_ACTION.returnReceive]: receiveHandler as ActionHandler<never, unknown>,
  };
}

/** Qué es cada acción, para la bandeja «Para revisar». */
export function describeQueuedAction(action: Pick<QueuedAction, "kind" | "payload">): string {
  const payload = (action.payload ?? {}) as Partial<PickingScanPayload & PickingLinePayload & ReturnReceivePayload>;
  const order = payload.orderNumber ? ` · ${payload.orderNumber}` : "";
  switch (action.kind) {
    case WAREHOUSE_ACTION.pickingScan:
      return `Escaneo ${payload.code ?? ""}${order}`.trim();
    case WAREHOUSE_ACTION.pickingConfirmLine:
      return `Confirmar sin escanear ${payload.lineName ?? "una línea"}${order}`;
    case WAREHOUSE_ACTION.pickingComplete:
      return `Completar picking${order}`;
    case WAREHOUSE_ACTION.returnReceive:
      return `Recibir devolución ${payload.orderLabel ?? ""}`.trim();
    default:
      return action.kind;
  }
}

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  pending: "Por enviar",
  sending: "Enviando…",
  uncertain: "Sin respuesta: se verifica antes de reenviar",
  review: "Para revisar",
};

/** Acciones de la sesión actual, separadas en «por enviar» y «para revisar», más las de otras sesiones. */
export function splitQueue(actions: QueuedAction[], session: QueueSession | null) {
  const mine = actions.filter((action) => session && action.companyId === session.companyId && action.userId === session.userId);
  return {
    outbox: mine.filter((action) => action.status !== "review"),
    review: mine.filter((action) => action.status === "review"),
    otherSessions: actions.length - mine.length,
  };
}

/** Acciones por enviar de un pedido (para avisar «3 escaneos guardados sin enviar»). */
export function pendingForOrder(outbox: QueuedAction[], orderId: string): number {
  return outbox.filter((action) => (action.payload as { orderId?: string } | null)?.orderId === orderId).length;
}

export function pendingForReception(outbox: QueuedAction[], receptionId: string): boolean {
  return outbox.some(
    (action) =>
      action.kind === WAREHOUSE_ACTION.returnReceive && (action.payload as { receptionId?: string } | null)?.receptionId === receptionId,
  );
}

/* ---------------------------------------------------------------------------
   Consultar
--------------------------------------------------------------------------- */

export interface ConsultWarehouse {
  inventoryId: string;
  name: string;
  physical: number;
  reserved: number;
  /** Físico − reservado (negativo = se vendió más de lo que hay). */
  available: number;
}

export interface ConsultVariant {
  variantId: string;
  productName: string;
  /** Atributos legibles, p. ej. «Talla: M · Color: Negro». */
  attributes: string;
  sku: string;
  companySku: string | null;
  matchedBy: VariantCodeMatch["matchedBy"] | null;
  totals: { physical: number; reserved: number; available: number };
  warehouses: ConsultWarehouse[];
}

export interface ConsultResult {
  code: string;
  variants: ConsultVariant[];
}

/** Junta lo que devolvió el código, los datos de la variante y su stock por almacén. */
export function buildConsultResult(
  code: string,
  matches: VariantCodeMatch[],
  variants: CatalogVariant[],
  stock: VariantStock[],
): ConsultResult {
  const variantById = new Map(variants.map((variant) => [variant.id.toLowerCase(), variant]));
  const stockById = new Map(stock.map((row) => [row.variant_id.toLowerCase(), row]));
  const seen = new Set<string>();
  const result: ConsultVariant[] = [];
  for (const match of matches) {
    const key = match.variantId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const variant = variantById.get(key);
    const warehouses = (stockById.get(key)?.inventories ?? [])
      .map((row) => ({
        inventoryId: row.inventory_id,
        name: row.inventory_name,
        physical: row.quantity,
        reserved: row.reserved_quantity,
        available: row.quantity - row.reserved_quantity,
      }))
      .sort((a, b) => b.available - a.available || a.name.localeCompare(b.name, "es"));
    const totals = warehouses.reduce(
      (sum, row) => ({ physical: sum.physical + row.physical, reserved: sum.reserved + row.reserved, available: sum.available + row.available }),
      { physical: 0, reserved: 0, available: 0 },
    );
    result.push({
      variantId: match.variantId,
      productName: variant?.productName || match.productName || "Producto sin nombre",
      attributes: formatVariantLabel(variant?.attributeValues),
      sku: variant?.sku || match.sku,
      companySku: variant?.companySku ?? match.companySku ?? null,
      matchedBy: match.matchedBy ?? null,
      totals,
      warehouses,
    });
  }
  return { code, variants: result };
}

export const MATCHED_BY_LABEL: Record<NonNullable<VariantCodeMatch["matchedBy"]>, string> = {
  sku: "SKU",
  companySku: "SKU de la empresa",
  barcode: "Código de fábrica",
  powipEan: "EAN de POWIP",
};

/* ---------------------------------------------------------------------------
   Lo último descargado
--------------------------------------------------------------------------- */

/** Clave de una copia local: siempre de un usuario y una empresa (otro usuario del celular no la ve). */
export function snapshotKey(session: QueueSession, ...parts: string[]): string {
  return [session.companyId, session.userId, ...parts].join(":");
}

const LIMA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** «hace un momento», «hace 5 min» o «17/11 14:05» (hora de Lima). */
export function formatSavedAt(savedAt: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const parts = Object.fromEntries(LIMA.formatToParts(new Date(savedAt)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}
