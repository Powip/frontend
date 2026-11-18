import { canEditInventory, canSeeProductCosts, isCourierRole, type RouteAccessUser } from "@/config/permissions.config";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { formatDay, formatMoney } from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { isWarehouseRole } from "@/lib/warehouseMode";
import { errorCode, errorStatus, opsErrorMessage } from "@/lib/warehouseOps";
import type { PdfDocSpec } from "@/lib/pdf/document";
import type {
  CourierClaim,
  CourierClaimStatus,
  CourierProvider,
  CourierReconciliation,
  CourierStock,
  CourierStockItem,
  CourierSyncMode,
  ReconciliationExplanation,
  ReconciliationLine,
  ReconciliationStatus,
} from "@/services/sharedCourierService";

// FEAT-24 H8 — reglas del front del courier compartido (Inventario › Couriers,
// la ficha del almacén courier y el portal del courier en /almacen): quién puede
// qué, textos, avisos del stock del courier, explicaciones de la conciliación,
// reclamos y su PDF. Funciones puras; las reglas de stock las aplica el backend.

/* ---------------------------------------------------------------------------
   Acceso (tabla de roles de la fachada, columna COURIER)
--------------------------------------------------------------------------- */

export interface CourierAccess {
  /** Ver almacenes courier, su stock y sus conciliaciones: Administrador, Operaciones, Almacén y COURIER. */
  view: boolean;
  /** Conciliar, el mapa de Aliclik y los reclamos: Administrador y Operaciones. */
  manage: boolean;
  /** Ver montos (costo, valor, reclamos, almacenaje). Sin esto la API los omite. */
  seeCosts: boolean;
  /** Usuario del courier: solo su almacén, sin montos ni reclamos, desde /almacen. */
  courier: boolean;
}

export function courierAccess(user?: RouteAccessUser | null): CourierAccess {
  const courier = isCourierRole(user?.role);
  const manage = !courier && canEditInventory(user ?? undefined);
  return {
    view: manage || courier || isWarehouseRole(user?.role),
    manage,
    seeCosts: !courier && canSeeProductCosts(user ?? undefined),
    courier,
  };
}

/* ---------------------------------------------------------------------------
   Textos
--------------------------------------------------------------------------- */

export const COURIER_PROVIDERS: CourierProvider[] = ["aliclik", "eva", "shalom", "olva", "otro"];
export const COURIER_SYNC_MODES: CourierSyncMode[] = ["api", "portal", "manual"];

export const COURIER_PROVIDER_LABEL: Record<CourierProvider, string> = {
  aliclik: "Aliclik",
  eva: "Eva",
  shalom: "Shalom",
  olva: "Olva",
  otro: "Otro",
};

export const SYNC_MODE_LABEL: Record<CourierSyncMode, string> = {
  api: "Por API",
  portal: "Portal del courier",
  manual: "Carga manual",
};

export const SYNC_MODE_HELP: Record<CourierSyncMode, string> = {
  api: "POWIP lee el stock del courier cada 5 minutos (solo Aliclik).",
  portal: "El personal del courier cuenta en POWIP, en el modo almacén.",
  manual: "Alguien de tu equipo carga lo que reporta el courier como un conteo.",
};

export const providerText = (provider: CourierProvider | null | undefined): string =>
  provider ? (COURIER_PROVIDER_LABEL[provider] ?? provider) : "Courier sin definir";

/** «Aliclik · Por API», «Olva · Portal del courier» o «Sin datos del courier». */
export function syncText(warehouse: { courierProvider: CourierProvider | null; syncMode: CourierSyncMode | null }): string {
  if (!warehouse.courierProvider && !warehouse.syncMode) return "Sin datos del courier";
  return [providerText(warehouse.courierProvider), warehouse.syncMode ? SYNC_MODE_LABEL[warehouse.syncMode] : "sin modo de sincronización"].join(" · ");
}

const MUTED = "bg-muted text-muted-foreground";
const AMBER = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
const GREEN = "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
const RED = "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
const SKY = "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";

export const RECONCILIATION_STATUS_LABEL: Record<ReconciliationStatus, string> = {
  abierta: "Abierta",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const RECONCILIATION_STATUS_CLASS: Record<ReconciliationStatus, string> = {
  abierta: AMBER,
  cerrada: GREEN,
  anulada: MUTED,
};

export const CLAIM_STATUSES: CourierClaimStatus[] = ["abierto", "aceptado", "cobrado", "rechazado"];

export const CLAIM_STATUS_LABEL: Record<CourierClaimStatus, string> = {
  abierto: "Abierto",
  aceptado: "Aceptado",
  cobrado: "Cobrado",
  rechazado: "Rechazado",
};

export const CLAIM_STATUS_CLASS: Record<CourierClaimStatus, string> = {
  abierto: AMBER,
  aceptado: SKY,
  cobrado: GREEN,
  rechazado: RED,
};

/** Los cambios de estado que acepta el servidor. Cobrado y rechazado ya no cambian. */
export const NEXT_CLAIM_STATUSES: Record<CourierClaimStatus, Array<Exclude<CourierClaimStatus, "abierto">>> = {
  abierto: ["aceptado", "rechazado"],
  aceptado: ["cobrado", "rechazado"],
  cobrado: [],
  rechazado: [],
};

export const CLAIM_ACTION_LABEL: Record<Exclude<CourierClaimStatus, "abierto">, string> = {
  aceptado: "El courier lo aceptó",
  cobrado: "Marcar cobrado",
  rechazado: "El courier lo rechazó",
};

export const CLAIM_ORIGIN_LABEL: Record<CourierClaim["origin"], string> = {
  conciliacion: "Conciliación",
  conteo: "Conteo",
};

export const claimOriginText = (claim: Pick<CourierClaim, "origin" | "referenceNumber">): string =>
  [CLAIM_ORIGIN_LABEL[claim.origin] ?? claim.origin, claim.referenceNumber].filter(Boolean).join(" ");

/** Cantidad con signo: «+2», «-1», «0». */
export const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/** Nombre del producto con sus atributos (y el SKU aparte). */
export function stockItemLabel(item: Pick<CourierStockItem, "productName" | "attributes" | "sku">): string {
  const name = item.productName?.trim() || (item.sku ? "" : "Variante fuera del catálogo");
  return [name, formatVariantLabel(item.attributes)].filter(Boolean).join(" · ") || item.sku || "Producto";
}

/* ---------------------------------------------------------------------------
   Stock del courier: de dónde sale y si está al día
--------------------------------------------------------------------------- */

export type NoticeTone = "red" | "amber" | "slate";

export interface CourierNotice {
  key: string;
  tone: NoticeTone;
  text: string;
}

/** Lo que reporta el courier: de dónde sale y qué hay que saber antes de comparar. */
export function courierStockNotices(stock: Pick<CourierStock, "courier" | "basis">, options: { portal?: boolean } = {}): CourierNotice[] {
  const side = stock.courier;
  const notices: CourierNotice[] = [];
  if (side.source === "api" && !side.available) {
    notices.push({
      key: "api-down",
      tone: "red",
      text: `${side.message || "No pudimos leer el stock de Aliclik. Inténtalo de nuevo."} Lo de POWIP se muestra igual.`,
    });
    return notices;
  }
  if (side.source === "api" && side.available) {
    if (!side.mapped)
      notices.push({
        key: "unmapped",
        tone: "amber",
        text: options.portal
          ? "Este almacén todavía no tiene almacenes de Aliclik asignados."
          : "Este almacén todavía no tiene almacenes de Aliclik asignados: elígelos en su ficha (Configuración › Tiendas y almacenes).",
      });
    if (side.stale)
      notices.push({
        key: "stale",
        tone: "amber",
        text: side.lastSyncedAt
          ? `Dato viejo: Aliclik no se sincroniza hace más de 30 minutos (última lectura: ${formatPeruDateTime(side.lastSyncedAt)}).`
          : "Dato viejo: Aliclik todavía no se sincronizó con este almacén.",
      });
    if (side.unlinked.skus > 0)
      notices.push({
        key: "unlinked",
        tone: "slate",
        text: `${side.unlinked.skus} SKU de Aliclik sin vincular (${side.unlinked.units} und): se ven como diferencia.${options.portal ? "" : " Vincúlalos en Inventario › Unificación."}`,
      });
    return notices;
  }
  if (side.source === "conteo") {
    notices.push({
      key: "count",
      tone: "slate",
      text: `Lo que reporta el courier sale del conteo ${side.countNumber}${side.countedAt ? ` (${formatPeruDateTime(side.countedAt)})` : ""}.`,
    });
    return notices;
  }
  notices.push({
    key: "none",
    tone: "amber",
    text: options.portal
      ? "Todavía no hay un conteo de este almacén: cuenta desde «Contar» para comparar."
      : "Todavía no hay stock del courier: pídele que cuente en el portal o carga un conteo del almacén.",
  });
  return notices;
}

/** «Disponible» con la API (Aliclik descuenta lo reservado) o «Físico» con un conteo. */
export const basisLabel = (basis: CourierStock["basis"]): string => (basis === "disponible" ? "Disponible" : "Físico");

export interface CourierStockSummary {
  withDifference: number;
  courierKnown: boolean;
}

export function courierStockSummary(stock: Pick<CourierStock, "items">): CourierStockSummary {
  return {
    withDifference: stock.items.filter((item) => item.difference !== null && item.difference !== 0).length,
    courierKnown: stock.items.some((item) => item.courier !== null),
  };
}

/** Último dato del courier, para la tarjeta «Sincronización». */
export function lastReadingText(stock: Pick<CourierStock, "courier">): string {
  const side = stock.courier;
  if (side.source === "api") return side.available ? (side.lastSyncedAt ? formatPeruDateTime(side.lastSyncedAt) : "Nunca") : "Sin respuesta";
  if (side.source === "conteo") return `${side.countNumber}${side.countedAt ? ` · ${formatDay(side.countedAt)}` : ""}`;
  return "Sin datos";
}

/* ---------------------------------------------------------------------------
   Conciliación: explicaciones y acciones que la cuadran
--------------------------------------------------------------------------- */

export const EXPLANATION_LABEL: Record<string, string> = {
  traslado_en_camino: "traslado en camino",
  devolucion_por_recibir: "devolución por recibir",
  merma_por_aprobar: "merma por aprobar",
  despacho_sin_pedido: "despacho sin pedido",
  merma_courier: "merma del courier",
};

export const MANUAL_EXPLANATION_TYPES = ["despacho_sin_pedido", "merma_courier"] as const;

/** «+2 traslado en camino (TRA-0003)»: lo que cuenta de verdad, y lo que no cuenta entre paréntesis. */
export function explanationText(explanation: ReconciliationExplanation): string {
  const label = EXPLANATION_LABEL[explanation.type] ?? explanation.type;
  const refs = (explanation.references ?? []).map((ref) => ref.number).filter(Boolean);
  const reference = explanation.reference?.trim();
  const tail = [...refs, ...(reference ? [reference] : [])];
  const applied = Number(explanation.applied ?? explanation.quantity);
  const unused = applied !== explanation.quantity ? ` · cuenta ${signed(applied)} de ${signed(explanation.quantity)}` : "";
  return `${signed(explanation.quantity)} ${label}${tail.length ? ` (${tail.join(", ")})` : ""}${unused}`;
}

export interface SquareAction {
  key: string;
  label: string;
  href: string;
}

/**
 * Enlaces a las pantallas que cuadran la línea (la conciliación solo enlaza y recalcula): recibir el traslado
 * (Traslados), recibir la devolución (Recepciones), aprobar o registrar la merma (Ajustes). En el portal del
 * courier solo recibir traslados.
 */
export function squareActions(line: Pick<ReconciliationLine, "explanations" | "unexplained">, options: { portal?: boolean } = {}): SquareAction[] {
  const types = new Set(line.explanations.filter((explanation) => explanation.source === "auto" && explanation.applied !== 0).map((explanation) => explanation.type));
  const actions: SquareAction[] = [];
  if (types.has("traslado_en_camino"))
    actions.push({ key: "transfer", label: "Recibir traslado", href: options.portal ? "/almacen/recibir/traslados" : "/inventario/traslados" });
  if (options.portal) return actions;
  if (types.has("devolucion_por_recibir")) actions.push({ key: "return", label: "Recibir devolución", href: "/inventario/recepciones" });
  if (types.has("merma_por_aprobar")) actions.push({ key: "approve", label: "Aprobar merma", href: "/inventario/ajustes" });
  else if (line.unexplained < 0) actions.push({ key: "shrink", label: "Registrar merma", href: "/inventario/ajustes" });
  return actions;
}

/** Faltante sin explicar de la línea (lo que se puede reclamar), en positivo. */
export const claimableUnits = (line: Pick<ReconciliationLine, "unexplained">): number => (line.unexplained < 0 ? -line.unexplained : 0);

export function reconciliationSourceText(reconciliation: Pick<CourierReconciliation, "source" | "countNumber" | "basis">): string {
  const source = reconciliation.source === "api" ? "API de Aliclik" : `Conteo ${reconciliation.countNumber ?? ""}`.trim();
  return `${source} · compara con el ${reconciliation.basis === "disponible" ? "disponible" : "físico"} de POWIP`;
}

/** Al cerrar con líneas sin explicar la nota es obligatoria (el servidor responde 400 si falta). */
export const closeNeedsNote = (reconciliation: Pick<CourierReconciliation, "summary">): boolean => reconciliation.summary.unexplainedLines > 0;

/** Solo se anula sin reclamos (409 si no). */
export const canCancelReconciliation = (reconciliation: Pick<CourierReconciliation, "status" | "claims">): boolean =>
  reconciliation.status === "abierta" && (reconciliation.claims ?? []).length === 0;

/* ---------------------------------------------------------------------------
   Errores
--------------------------------------------------------------------------- */

/**
 * 409 `ALICLIK_WAREHOUSE_TAKEN`: un almacén de Aliclik ya apunta a otro almacén de POWIP. Dice cuál (con el
 * nombre si se conoce) y cómo destrabarlo; el resto, como cualquier error de la operación de almacén.
 */
export function aliclikMapErrorMessage(
  error: unknown,
  names: { aliclik: (aliclikWarehouseId: number) => string | null; powip: (inventoryId: string) => string | null },
): string {
  if (errorStatus(error) === 409 && errorCode(error) === "ALICLIK_WAREHOUSE_TAKEN") {
    const data = (error as { response?: { data?: { aliclikWarehouseId?: unknown; inventoryId?: unknown } } }).response?.data ?? {};
    const aliclikId = Number(data.aliclikWarehouseId);
    const aliclik = Number.isFinite(aliclikId) ? names.aliclik(aliclikId) || `el almacén ${aliclikId} de Aliclik` : "Uno de los almacenes de Aliclik";
    const other = typeof data.inventoryId === "string" ? names.powip(data.inventoryId) : null;
    return `${aliclik[0].toUpperCase()}${aliclik.slice(1)} ya está asignado a ${other ? `«${other}»` : "otro almacén de POWIP"}. Quítalo de ese almacén primero y vuelve a guardar.`;
  }
  return opsErrorMessage(error, "No se pudo guardar el mapa de Aliclik.");
}

/* ---------------------------------------------------------------------------
   PDF del reclamo (helper común de H10)
--------------------------------------------------------------------------- */

export function courierClaimPdfSpec(claim: CourierClaim, options: { warehouseName?: string } = {}): PdfDocSpec {
  const masked = !("totalAmount" in claim);
  const lines = claim.lines ?? [];
  const history = claim.history ?? [];
  const lastChange = history.length ? history[history.length - 1] : undefined;
  return {
    title: "Reclamo a courier",
    number: claim.number,
    date: formatDay(claim.createdAt),
    meta: [
      ["Courier", providerText(claim.courierProvider)],
      ["Almacén", options.warehouseName ?? "—"],
      ["Origen", claimOriginText(claim)],
      ["Estado", CLAIM_STATUS_LABEL[claim.status] ?? claim.status],
      ["Unidades", String(claim.totalUnits)],
      ...(claim.status === "cobrado" ? ([["Cobrado", masked ? "••••" : formatMoney(claim.collectedAmount ?? null)]] as Array<[string, string]>) : []),
    ],
    tables: [
      {
        head: ["SKU", "Producto", "Cantidad faltante", "Costo unit.", "Valor reclamado"],
        rows: lines.map((line) => [
          line.sku ?? "—",
          line.productName ?? "Producto",
          String(line.quantity),
          formatMoney("unitCost" in line ? (line.unitCost ?? null) : undefined, 4),
          formatMoney("amount" in line ? (line.amount ?? null) : undefined),
        ]),
        align: ["left", "left", "right", "right", "right"],
      },
    ],
    foot: [["Total reclamado", masked ? "••••" : formatMoney(claim.totalAmount ?? null)]],
    note:
      [
        claim.notes ? `Notas: ${claim.notes}` : null,
        claim.linesWithoutCost > 0 ? `${claim.linesWithoutCost} línea(s) sin costo no suman al total.` : null,
        lastChange?.note ? `Último cambio (${CLAIM_STATUS_LABEL[lastChange.toStatus] ?? lastChange.toStatus}): ${lastChange.note}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    signatures: ["Por la empresa", "Por el courier"],
    fileName: claim.number,
  };
}
