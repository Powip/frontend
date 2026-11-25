import { canEditInventory, canSeeProductCosts, type RouteAccessUser } from "@/config/permissions.config";
import { isNetworkError } from "@/lib/offlineStore";
import { isCompanyAdminRole } from "@/lib/purchaseOrders";
import { isWarehouseRole } from "@/lib/warehouseMode";
import type {
  AdjustmentKind,
  AdjustmentReasonCode,
  AdjustmentStatus,
  CountDecision,
  CountLine,
  CountScope,
  CountStatus,
  CreateAdjustmentBody,
  InvestigationResolution,
  ReceiveTransferLineInput,
  SaveTransferBody,
  StockAdjustmentDoc,
  StockCount,
  Transfer,
  TransferDifferenceDecision,
  TransferStatus,
  UnresolvedReason,
} from "@/services/warehouseOpsService";
import type { VariantCodeMatch } from "@/services/variantCodesService";

// FEAT-24 H5-C — reglas del front de la operación de almacén (traslados,
// ajustes y mermas, conteos y pendientes): quién puede qué, textos de estados,
// mensajes de error y los borradores de los formularios. Funciones puras: las
// pantallas solo las usan. Las reglas de stock las aplica el backend.

/* ---------------------------------------------------------------------------
   Acceso (H5-D11 + H6, tabla de la fachada H5-B): por ROL
--------------------------------------------------------------------------- */

export interface WarehouseOpsAccess {
  /** Armar, editar, despachar y recibir traslados; pedir ajustes; armar, contar y cerrar conteos. */
  operate: boolean;
  /** Además: anular traslados; validar, aplicar y anular conteos; pendientes; ubicaciones y datos del almacén. */
  manage: boolean;
  /** Además: aprobar y rechazar ajustes, anular ajustes aplicados y asignar almacenes a usuarios. */
  admin: boolean;
  /** Ve costos y montos. Sin esto la API los omite y se muestra «••••». */
  seeCosts: boolean;
}

export function warehouseOpsAccess(user?: RouteAccessUser | null): WarehouseOpsAccess {
  const manage = canEditInventory(user ?? undefined);
  return {
    operate: manage || isWarehouseRole(user?.role),
    manage,
    admin: isCompanyAdminRole(user?.role),
    seeCosts: canSeeProductCosts(user ?? undefined),
  };
}

/* ---------------------------------------------------------------------------
   Errores: 423 periodo cerrado, 403 sin acceso, 409 stock o estado
--------------------------------------------------------------------------- */

interface ApiErrorShape {
  response?: { status?: number; data?: { message?: unknown; code?: unknown; period?: unknown } };
}

export const errorStatus = (error: unknown): number | undefined => (error as ApiErrorShape | null)?.response?.status;

export const errorCode = (error: unknown): string | undefined => {
  const code = (error as ApiErrorShape | null)?.response?.data?.code;
  return typeof code === "string" ? code : undefined;
};

function serverText(error: unknown): string | null {
  const message = (error as ApiErrorShape | null)?.response?.data?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim() !== "").map((part) => part.trim());
    return parts.length ? parts.join(". ") : null;
  }
  return typeof message === "string" && message.trim() !== "" ? message.trim() : null;
}

export const isPeriodClosedError = (error: unknown): boolean => errorStatus(error) === 423 || errorCode(error) === "PERIODO_CERRADO";

/**
 * Mensaje claro para el usuario. 423: el periodo está cerrado (con qué reabrir); 403: sin acceso al almacén o sin
 * rol; 409: stock insuficiente o estado (el mensaje del servidor trae el SKU o el motivo).
 */
export function opsErrorMessage(error: unknown, fallback: string): string {
  const status = errorStatus(error);
  const text = serverText(error);
  if (isPeriodClosedError(error)) {
    const period = (error as ApiErrorShape).response?.data?.period;
    const base = text ?? `El periodo${typeof period === "string" ? ` ${period}` : ""} está cerrado.`;
    return `${base} Para hacer este cambio, el Administrador tiene que reabrir el periodo en Inventario › Cierre mensual.`;
  }
  if (status === 403) return text ?? "No tienes permiso para hacer esto en este almacén.";
  if (status === 409) return text ?? "El stock o el estado cambió: actualiza y revisa antes de reintentar.";
  if (status === 503) return text ?? "El servicio de inventario no responde. Inténtalo de nuevo en unos minutos.";
  if (status === undefined && isNetworkError(error))
    return "No hubo respuesta del servidor. Reintenta: la acción no se duplica.";
  return text ?? fallback;
}

/* ---------------------------------------------------------------------------
   Textos
--------------------------------------------------------------------------- */

const MUTED = "bg-muted text-muted-foreground";
const AMBER = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
const GREEN = "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
const RED = "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
const SKY = "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  borrador: "Borrador",
  en_camino: "En camino",
  recibido: "Recibido",
  recibido_con_diferencia: "Con diferencia",
  anulado: "Anulado",
};

export const TRANSFER_STATUS_CLASS: Record<TransferStatus, string> = {
  borrador: MUTED,
  en_camino: AMBER,
  recibido: GREEN,
  recibido_con_diferencia: RED,
  anulado: `${MUTED} line-through`,
};

export const TRANSFER_DECISION_LABEL: Record<string, string> = {
  pendiente: "Pendiente de investigar",
  perdida: "Pérdida",
  reclamo: "Reclamo",
  sobrante: "Sobrante",
};

export const ADJUSTMENT_STATUS_LABEL: Record<AdjustmentStatus, string> = {
  pendiente_aprobacion: "Pendiente de aprobación",
  aplicado: "Aplicado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

export const ADJUSTMENT_STATUS_CLASS: Record<AdjustmentStatus, string> = {
  pendiente_aprobacion: AMBER,
  aplicado: GREEN,
  rechazado: MUTED,
  anulado: `${MUTED} line-through`,
};

export const ADJUSTMENT_REASON_LABEL: Record<AdjustmentReasonCode, string> = {
  dano: "Daño",
  vencimiento: "Vencimiento",
  robo: "Robo",
  error_registro: "Error de registro",
  muestra: "Muestra",
  otro: "Otro",
};

export const ADJUSTMENT_REASONS = Object.keys(ADJUSTMENT_REASON_LABEL) as AdjustmentReasonCode[];

export const COUNT_STATUS_LABEL: Record<CountStatus, string> = {
  en_curso: "En curso",
  por_validar: "Por validar",
  aplicado: "Aplicado",
  anulado: "Anulado",
};

export const COUNT_STATUS_CLASS: Record<CountStatus, string> = {
  en_curso: SKY,
  por_validar: AMBER,
  aplicado: GREEN,
  anulado: `${MUTED} line-through`,
};

export const COUNT_SCOPE_LABEL: Record<CountScope, string> = {
  total: "Todo el almacén",
  categoria: "Una categoría",
  marca: "Una marca",
  ubicacion: "Una ubicación",
  seleccion: "Productos elegidos",
};

export const COUNT_DECISION_LABEL: Record<CountDecision | "auto", string> = {
  corregir_origen: "Corregir el origen (venta o devolución sin registrar)",
  perdida: "Dar como pérdida (gasto)",
  sobrante: "Ingresar sobrante",
  reclamo_courier: "Reclamo al courier",
  pendiente: "Pendiente de investigar",
  auto: "Dentro de la tolerancia",
};

export const INVESTIGATION_RESOLUTION_LABEL: Record<InvestigationResolution, string> = {
  encontrado: "Se encontró (corregir el origen)",
  perdida: "Dar como pérdida",
  reclamo: "Reclamo",
  otro: "Otro",
};

export const INVESTIGATION_ORIGIN_LABEL: Record<string, string> = {
  conteo: "Conteo",
  traslado: "Traslado",
  conciliacion: "Conciliación courier",
};

export const UNRESOLVED_REASON_LABEL: Record<UnresolvedReason, string> = {
  no_encontrado: "no es de ningún producto de tu catálogo",
  ambiguo: "corresponde a más de un producto: usa el SKU",
  fuera_del_conteo: "no está en este conteo",
};

/** Producto + SKU para mostrar en una línea. */
export const lineLabel = (line: { productName?: string | null; sku?: string | null }): string =>
  line.productName?.trim() || line.sku?.trim() || "Producto";

/** Entero válido entre `min` y `max` (o `null`). */
export function parseQuantity(raw: string, min = 0, max = 10_000): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/* ---------------------------------------------------------------------------
   Traslados: formulario (borrador)
--------------------------------------------------------------------------- */

export interface DraftLine {
  variantId: string;
  label: string;
  sku: string;
  quantity: string;
  /** FEAT-24 H5-L: lote elegido (vacío = automático: sale primero el que vence antes; en una entrada, «sin lote»). */
  lotId?: string;
}

/** FEAT-24 H5-L: al cambiar el almacén o el sentido, el lote elegido deja de valer. */
export const clearDraftLots = (lines: DraftLine[]): DraftLine[] =>
  lines.some((line) => line.lotId) ? lines.map((line) => (line.lotId ? { ...line, lotId: "" } : line)) : lines;

export interface TransferForm {
  originInventoryId: string;
  destinationInventoryId: string;
  freight: string;
  remissionGuide: string;
  notes: string;
  lines: DraftLine[];
}

/** Formulario vacío; origen y destino pueden venir de los filtros de la lista (nunca el mismo almacén en los dos). */
export const emptyTransferForm = (originInventoryId = "", destinationInventoryId = ""): TransferForm => ({
  originInventoryId,
  destinationInventoryId: destinationInventoryId && destinationInventoryId !== originInventoryId ? destinationInventoryId : "",
  freight: "",
  remissionGuide: "",
  notes: "",
  lines: [],
});

export function transferFormFrom(transfer: Transfer): TransferForm {
  return {
    originInventoryId: transfer.originInventoryId,
    destinationInventoryId: transfer.destinationInventoryId,
    freight: transfer.freight ? String(transfer.freight) : "",
    remissionGuide: transfer.remissionGuide ?? "",
    notes: transfer.notes ?? "",
    lines: transfer.lines.map((line) => ({
      variantId: line.variantId,
      label: lineLabel(line),
      sku: line.sku ?? "",
      quantity: String(line.quantitySent),
      ...(line.lotId ? { lotId: line.lotId } : {}),
    })),
  };
}

/** Agrega las variantes que no estaban (una línea por variante). */
export function addDraftLines(lines: DraftLine[], incoming: DraftLine[]): { lines: DraftLine[]; added: number } {
  const known = new Set(lines.map((line) => line.variantId));
  const fresh = incoming.filter((line) => !known.has(line.variantId) && known.add(line.variantId));
  return { lines: [...lines, ...fresh], added: fresh.length };
}

const MONEY_TEXT = /^\d+(\.\d{1,2})?$/;

/** Lo que falta para guardar el traslado (o `null`). `available` = disponible en el origen por variante. */
export function transferFormProblem(form: TransferForm, available?: ReadonlyMap<string, number>): string | null {
  if (!form.originInventoryId) return "Elige el almacén de origen.";
  if (!form.destinationInventoryId) return "Elige el almacén de destino.";
  if (form.originInventoryId === form.destinationInventoryId) return "El origen y el destino deben ser distintos.";
  if (form.freight.trim() !== "" && !MONEY_TEXT.test(form.freight.trim())) return "El flete tiene que ser un monto (hasta 2 decimales).";
  if (form.remissionGuide.trim().length > 50) return "La guía de remisión tiene hasta 50 caracteres.";
  const withQuantity = form.lines.filter((line) => line.quantity.trim() !== "" && line.quantity.trim() !== "0");
  if (withQuantity.length === 0) return "Agrega al menos un producto con cantidad.";
  for (const line of withQuantity) {
    const quantity = parseQuantity(line.quantity, 1);
    if (quantity === null) return `Revisa la cantidad de ${line.label}: entero entre 1 y 10.000.`;
    const max = available?.get(line.variantId);
    if (max !== undefined && quantity > max) return `${line.label}: solo hay ${Math.max(max, 0)} disponibles en el origen.`;
  }
  return null;
}

export function buildTransferBody(form: TransferForm): SaveTransferBody {
  const freight = form.freight.trim();
  return {
    originInventoryId: form.originInventoryId,
    destinationInventoryId: form.destinationInventoryId,
    lines: form.lines
      .map((line) => ({ variantId: line.variantId, quantity: parseQuantity(line.quantity, 1) ?? 0, ...(line.lotId ? { lotId: line.lotId } : {}) }))
      .filter((line) => line.quantity > 0),
    ...(freight ? { freight: Number(freight) } : {}),
    ...(form.remissionGuide.trim() ? { remissionGuide: form.remissionGuide.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}

export const transferUnits = (transfer: Pick<Transfer, "lines">): number =>
  transfer.lines.reduce((sum, line) => sum + (Number(line.quantitySent) || 0), 0);

export const transferReceivedUnits = (transfer: Pick<Transfer, "lines">): number =>
  transfer.lines.reduce((sum, line) => sum + (Number(line.quantityReceived) || 0), 0);

/** Se puede anular: borrador, o en camino sin ninguna línea recibida (si no, hay que recibir lo que falta). */
export const canCancelTransfer = (transfer: Pick<Transfer, "status" | "lines">): boolean =>
  transfer.status === "borrador" || (transfer.status === "en_camino" && transfer.lines.every((line) => line.receivedAt === null && line.quantityReceived === null));

/* ---------------------------------------------------------------------------
   Traslados: recepción (por línea, una vez cada línea)
--------------------------------------------------------------------------- */

export interface TransferReceiveLine {
  itemId: string;
  variantId: string;
  label: string;
  sku: string;
  sent: number;
  quantity: string;
  /** Recepción parcial: las que no se incluyen se reciben después. */
  include: boolean;
  decision: TransferDifferenceDecision;
  responsible: string;
  dueDate: string;
}

const pendingLine = (line: Transfer["lines"][number]) => line.quantityReceived === null && line.receivedAt === null;

/** Las líneas que faltan recibir. `fill: "sent"` (escritorio) o `"zero"` (celular escaneando). */
export function transferReceiveDraft(transfer: Transfer, fill: "sent" | "zero" = "sent"): TransferReceiveLine[] {
  return transfer.lines.filter(pendingLine).map((line) => ({
    itemId: line.id,
    variantId: line.variantId,
    label: lineLabel(line),
    sku: line.sku ?? "",
    sent: Number(line.quantitySent) || 0,
    quantity: fill === "sent" ? String(line.quantitySent) : "0",
    include: true,
    decision: "pendiente",
    responsible: "",
    dueDate: "",
  }));
}

/** Diferencia de la línea (recibido − enviado) o `null` si la cantidad no es válida. */
export function receiveLineDifference(line: TransferReceiveLine): number | null {
  const received = parseQuantity(line.quantity, 0);
  return received === null ? null : received - line.sent;
}

export function receiveLineProblem(line: TransferReceiveLine): string | null {
  if (!line.include) return null;
  if (parseQuantity(line.quantity, 0) === null) return "Entero entre 0 y 10.000.";
  if (line.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(line.dueDate)) return "Fecha inválida.";
  return null;
}

export function transferReceiveProblem(lines: TransferReceiveLine[]): string | null {
  const included = lines.filter((line) => line.include);
  if (included.length === 0) return "Marca al menos una línea para recibir.";
  const bad = included.find((line) => receiveLineProblem(line));
  return bad ? `Revisa ${bad.label}: ${receiveLineProblem(bad)}` : null;
}

/** El cuerpo de `receive`: solo las líneas incluidas; la decisión solo viaja si falta algo. */
export function buildTransferReceiveLines(lines: TransferReceiveLine[]): ReceiveTransferLineInput[] {
  return lines
    .filter((line) => line.include)
    .map((line) => {
      const quantityReceived = parseQuantity(line.quantity, 0) ?? 0;
      const short = quantityReceived < line.sent;
      return {
        itemId: line.itemId,
        quantityReceived,
        ...(short ? { decision: line.decision } : {}),
        ...(short && line.responsible.trim() ? { responsible: line.responsible.trim() } : {}),
        ...(short && line.dueDate ? { dueDate: line.dueDate } : {}),
      };
    });
}

export type TransferScanOutcome = { kind: "added"; itemId: string } | { kind: "not_found" } | { kind: "not_in_transfer" };

/** Un escaneo en la recepción: suma 1 a la línea de esa variante (pasar lo enviado es un sobrante y se permite). */
export function resolveTransferScan(matches: VariantCodeMatch[], lines: TransferReceiveLine[]): TransferScanOutcome {
  if (matches.length === 0) return { kind: "not_found" };
  const ids = new Set(matches.map((match) => match.variantId.toLowerCase()));
  const line = lines.find((candidate) => ids.has(candidate.variantId.toLowerCase()));
  return line ? { kind: "added", itemId: line.itemId } : { kind: "not_in_transfer" };
}

export function addOneToTransferLine(lines: TransferReceiveLine[], itemId: string): TransferReceiveLine[] {
  return lines.map((line) =>
    line.itemId === itemId ? { ...line, include: true, quantity: String((parseQuantity(line.quantity, 0) ?? 0) + 1) } : line,
  );
}

/* ---------------------------------------------------------------------------
   Ajustes y mermas
--------------------------------------------------------------------------- */

/** Tipo del formulario (mockup): ajuste positivo (sobra), negativo (falta) o merma. */
export type AdjustmentType = "positivo" | "negativo" | "merma";

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  positivo: "Ajuste positivo (sobra)",
  negativo: "Ajuste negativo (falta)",
  merma: "Merma (dañado, vencido, perdido)",
};

export interface AdjustmentForm {
  inventoryId: string;
  type: AdjustmentType;
  reason: AdjustmentReasonCode | "";
  note: string;
  lines: DraftLine[];
}

export const emptyAdjustmentForm = (inventoryId = ""): AdjustmentForm => ({ inventoryId, type: "merma", reason: "", note: "", lines: [] });

export function adjustmentFormProblem(form: AdjustmentForm): string | null {
  if (!form.inventoryId) return "Elige el almacén.";
  if (!form.reason) return "Elige el motivo.";
  if (form.reason === "otro" && !form.note.trim()) return "Con el motivo «Otro», escribe una nota.";
  if (form.note.trim().length > 300) return "La nota tiene hasta 300 caracteres.";
  if (form.lines.length === 0) return "Agrega al menos un producto.";
  const bad = form.lines.find((line) => parseQuantity(line.quantity, 1) === null);
  return bad ? `Revisa la cantidad de ${bad.label}: entero entre 1 y 10.000.` : null;
}

/** `allowNegative` (FEAT-24 C-D3): las salidas que dejan el físico en negativo están confirmadas; solo viaja si es `true`. */
export function buildAdjustmentBody(form: AdjustmentForm, operationId: string, allowNegative = false): CreateAdjustmentBody {
  const kind: AdjustmentKind = form.type === "merma" ? "merma" : "ajuste";
  const direction = form.type === "positivo" ? "IN" : "OUT";
  return {
    inventoryId: form.inventoryId,
    kind,
    reason: form.reason as AdjustmentReasonCode,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    lines: form.lines.map((line) => ({
      variantId: line.variantId,
      quantity: parseQuantity(line.quantity, 1) ?? 0,
      direction,
      ...(line.lotId ? { lotId: line.lotId } : {}),
    })),
    operationId,
    ...(allowNegative ? { allowNegative: true as const } : {}),
  };
}

/** «Merma», «Ajuste positivo», «Ajuste negativo» o «Ajuste» (mixto). */
export function adjustmentTypeLabel(doc: Pick<StockAdjustmentDoc, "kind" | "lines">): string {
  if (doc.kind === "merma") return "Merma";
  const signs = new Set(doc.lines.map((line) => Math.sign(line.quantityDelta)));
  if (signs.size === 1 && signs.has(1)) return "Ajuste positivo";
  if (signs.size === 1 && signs.has(-1)) return "Ajuste negativo";
  return "Ajuste";
}

export const adjustmentUnits = (doc: Pick<StockAdjustmentDoc, "lines">): number =>
  doc.lines.reduce((sum, line) => sum + (Number(line.quantityDelta) || 0), 0);

/* ---------------------------------------------------------------------------
   Conteos
--------------------------------------------------------------------------- */

/** Conteo ciego abierto: no se muestra ni se calcula nada del sistema (esperado, diferencias). */
export const countHidesSystem = (count: Pick<StockCount, "blind" | "status">): boolean => count.blind && count.status === "en_curso";

/** La línea quedó fuera de la tolerancia y espera una decisión del supervisor. */
export function countLineNeedsDecision(line: CountLine, status: CountStatus): boolean {
  if (status !== "por_validar") return false;
  if (line.decision === "auto") return false;
  if (line.withinTolerance === true) return false;
  return typeof line.difference === "number" && line.difference !== 0;
}

/** Decisiones posibles para una diferencia (mockup): sobrante solo si sobra, pérdida solo si falta, courier solo en su almacén. */
export function countDecisionOptions(difference: number, courierWarehouse: boolean): CountDecision[] {
  const all: CountDecision[] = ["corregir_origen", "perdida", "sobrante", "reclamo_courier", "pendiente"];
  return all.filter((decision) => {
    if (decision === "sobrante") return difference > 0;
    if (decision === "perdida") return difference < 0;
    if (decision === "reclamo_courier") return courierWarehouse && difference < 0;
    return true;
  });
}

export interface CountDecisionDraft {
  decision: CountDecision | "";
  responsible: string;
  dueDate: string;
  note: string;
}

export function countDecisionProblem(draft: CountDecisionDraft): string | null {
  if (!draft.decision) return "Elige una decisión.";
  if (draft.decision === "pendiente" && (!draft.responsible.trim() || !draft.dueDate)) return "Pendiente de investigar pide responsable y fecha límite.";
  return null;
}

/** «12 de 30 contados». */
export function countProgress(count: Pick<StockCount, "summary" | "lines">): { counted: number; total: number } {
  if (count.lines) return { counted: count.lines.filter((line) => line.counted !== null && line.counted !== undefined).length, total: count.lines.length };
  return { counted: count.summary?.counted ?? 0, total: count.summary?.lines ?? 0 };
}

/** Une lo que devolvió `entries` con las líneas del conteo (sin tocar nada del sistema). */
export function mergeCountEntries(count: StockCount, applied: Array<{ lineId: string; counted: number }>): StockCount {
  if (!count.lines || applied.length === 0) return count;
  const byLine = new Map(applied.map((row) => [row.lineId, row.counted]));
  return { ...count, lines: count.lines.map((line) => (byLine.has(line.id) ? { ...line, counted: byLine.get(line.id) ?? line.counted } : line)) };
}

const LIMA_DATE_TIME = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** «17/11/2026 14:05» (hora de Lima) o «—». */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = Object.fromEntries(LIMA_DATE_TIME.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Quién hizo algo: el nombre o el correo del documento. */
export const whoDid = (name?: string | null, email?: string | null): string => name?.trim() || email?.trim() || "—";
