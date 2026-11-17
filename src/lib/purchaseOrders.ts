import { canEditInventory, canSeeProductCosts, type RouteAccessUser } from "@/config/permissions.config";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineInput,
  PurchaseOrderStatus,
  SavePurchaseOrderBody,
  SupplierPaymentTerms,
  SupplierReturnStatus,
} from "@/services/purchasesService";
import type { VariantCodeMatch } from "@/services/variantCodesService";

// FEAT-24 H3-E — reglas del front de compras (órdenes de compra, recepción,
// proveedores y devoluciones): quién puede qué, textos de estados, la vista
// previa de los montos (los definitivos los calcula el servidor) y el borrador
// de una recepción parcial. Funciones puras: las pantallas solo las usan.

/* ---------------------------------------------------------------------------
   Acceso (H3-D6): por ROL, igual que la fachada de ms-products
--------------------------------------------------------------------------- */

const COMPANY_ADMIN_ROLES = ["ADMIN", "ADMINISTRADOR", "OWNER", "SUPERADMIN"];

/** Administrador de la empresa (mismo criterio que `isCompanyAdmin` de la fachada: sin mayúsculas ni espacios). */
export const isCompanyAdminRole = (role?: string | null): boolean =>
  COMPANY_ADMIN_ROLES.includes((role ?? "").trim().toUpperCase());

export interface PurchaseAccess {
  /** Crear, editar y emitir OC, recibir, devoluciones (alta, envío y nota de crédito) y proveedores. */
  canWrite: boolean;
  /** Pago de la OC y anulaciones (de OC y de devolución). */
  canAdmin: boolean;
  /** Ve costos y montos. Sin esto la API omite las claves y se muestra «••••». */
  canSeeCosts: boolean;
}

export function purchaseAccess(user?: RouteAccessUser): PurchaseAccess {
  return {
    canWrite: canEditInventory(user),
    canAdmin: isCompanyAdminRole(user?.role),
    canSeeCosts: canSeeProductCosts(user),
  };
}

/* ---------------------------------------------------------------------------
   Textos
--------------------------------------------------------------------------- */

export const PURCHASE_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  BORRADOR: "Borrador",
  PEDIDA: "Pedida",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA: "Recibida",
  ANULADA: "Anulada",
};

/** Colores de la etiqueta de estado (mockup: borrador gris, pedida celeste, parcial ámbar, recibida verde). */
export const PURCHASE_STATUS_CLASS: Record<PurchaseOrderStatus, string> = {
  BORRADOR: "bg-muted text-muted-foreground",
  PEDIDA: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  RECIBIDA_PARCIAL: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  RECIBIDA: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  ANULADA: "bg-muted text-muted-foreground line-through",
};

export const PAYMENT_TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  contado: "Contado",
  credito_15: "Crédito 15 días",
  credito_30: "Crédito 30 días",
  credito_60: "Crédito 60 días",
};

export const PAYMENT_TERMS: SupplierPaymentTerms[] = ["contado", "credito_15", "credito_30", "credito_60"];

export const RETURN_STATUS_LABEL: Record<SupplierReturnStatus, string> = {
  borrador: "Borrador (sin enviar)",
  enviada: "Esperando nota de crédito",
  nc_recibida: "Nota de crédito recibida",
  anulada: "Anulada",
};

export const RETURN_STATUS_CLASS: Record<SupplierReturnStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  enviada: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  nc_recibida: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  anulada: "bg-muted text-muted-foreground line-through",
};

/** Tipos de comprobante del proveedor (los mismos valores que la compra directa de /registrar-compra). */
export const RECEIPT_TYPES: Array<{ value: string; label: string }> = [
  { value: "FACTURA", label: "Factura electrónica" },
  { value: "BOLETA", label: "Boleta" },
  { value: "SIN_COMPROBANTE", label: "Sin comprobante" },
];

/* ---------------------------------------------------------------------------
   Montos, fechas y costo enmascarado
--------------------------------------------------------------------------- */

/** Lo que se muestra cuando la API omitió un costo porque el rol no lo ve. */
export const MASK = "••••";

const MONEY = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COST = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Un monto que puede faltar: `undefined` = la API omitió la clave (sin permiso) → «••••»; `null` = no hay
 * dato → «—». `decimals: 4` para costos unitarios.
 */
export function formatMoney(value: number | null | undefined, decimals: 2 | 4 = 2): string {
  if (value === undefined) return MASK;
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return (decimals === 4 ? COST : MONEY).format(Number(value));
}

/** ¿La API omitió esta clave? (sin permiso de costos). */
export const isMasked = (source: object | null | undefined, key: string): boolean => !!source && !(key in source);

const LIMA_DATE = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });

/** Fecha de Lima «dd/mm/aaaa» de un instante ISO; un `YYYY-MM-DD` se muestra tal cual, sin zona. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = Object.fromEntries(LIMA_DATE.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/** Hoy en Lima como `YYYY-MM-DD` (para los campos de fecha). */
export function todayInLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 10);
}

/** Pago de la OC como en el mockup: «Pendiente · vence 20/11/2026», «Pagada · 18/11/2026» o «—». */
export function paymentText(order: Pick<PurchaseOrder, "status" | "paymentStatus" | "paidAt" | "dueDate">): string {
  if (order.status === "BORRADOR" || order.status === "ANULADA") return "—";
  if (order.paymentStatus === "pagada") return order.paidAt ? `Pagada · ${formatDay(order.paidAt)}` : "Pagada";
  return order.dueDate ? `Pendiente · vence ${formatDay(order.dueDate)}` : "Pendiente";
}

/** Unidades de stock de la OC (Σ cantidad × factor). */
export const orderUnits = (order: Pick<PurchaseOrder, "lines">): number =>
  order.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

export const orderReceivedUnits = (order: Pick<PurchaseOrder, "lines">): number =>
  order.lines.reduce((sum, line) => sum + (Number(line.receivedQuantity) || 0), 0);

/** «Polo · Talla: M» */
export function lineLabel(line: Pick<PurchaseOrderLine, "productName" | "attributes">): string {
  const attributes = formatVariantLabel(line.attributes);
  return [line.productName || "Producto sin nombre", attributes].filter(Boolean).join(" · ");
}

/** «2 Caja × 12» o «24 und». */
export function purchaseUnitText(line: Pick<PurchaseOrderLine, "purchaseUnit" | "purchaseFactor" | "purchaseQuantity" | "quantity">): string {
  if (line.purchaseUnit && line.purchaseFactor > 1) return `${line.purchaseQuantity} ${line.purchaseUnit} × ${line.purchaseFactor}`;
  return `${line.quantity} und`;
}

/* ---------------------------------------------------------------------------
   Qué se puede hacer con una OC
--------------------------------------------------------------------------- */

export const canEditOrder = (order: Pick<PurchaseOrder, "status">) => order.status === "BORRADOR";
export const canPlaceOrder = (order: Pick<PurchaseOrder, "status">) => order.status === "BORRADOR";
export const canReceiveOrder = (order: Pick<PurchaseOrder, "status">) =>
  order.status === "PEDIDA" || order.status === "RECIBIDA_PARCIAL";
export const canCancelOrder = (order: Pick<PurchaseOrder, "status">) => order.status !== "ANULADA";
export const canPayOrder = (order: Pick<PurchaseOrder, "status">) =>
  order.status === "PEDIDA" || order.status === "RECIBIDA_PARCIAL" || order.status === "RECIBIDA";

/** Unidades de una línea que todavía se pueden devolver al proveedor. */
export const returnableQuantity = (line: Pick<PurchaseOrderLine, "receivedQuantity" | "returnedQuantity">): number =>
  Math.max(0, (Number(line.receivedQuantity) || 0) - (Number(line.returnedQuantity) || 0));

/** Devolución a proveedor: de una compra recibida (o en parte), sin IMEI/serie y con algo por devolver. */
export const canReturnOrder = (order: Pick<PurchaseOrder, "status" | "hasTrackedUnits" | "lines">) =>
  (order.status === "RECIBIDA" || order.status === "RECIBIDA_PARCIAL") &&
  !order.hasTrackedUnits &&
  order.lines.some((line) => returnableQuantity(line) > 0);

/* ---------------------------------------------------------------------------
   Vista previa de los montos (H3-D3/D5; espejo de ms-logistics `computePurchaseOrder`)
--------------------------------------------------------------------------- */

export const IGV_RATE = 0.18;

/** Redondeo mitad hacia arriba con margen para la coma flotante (igual que el servidor). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(value) * factor + 1e-7) / factor;
  return value < 0 ? -rounded : rounded;
}

export interface PreviewLineInput {
  purchaseQuantity: number;
  purchaseFactor: number;
  unitPrice: number;
}

export interface PreviewLine {
  /** Unidades de stock. */
  quantity: number;
  /** Valor de la línea sin IGV. */
  lineNet: number;
  /** Costo por unidad sin IGV (4 decimales). */
  unitCostNet: number;
  /** Costo final por unidad: sin IGV + gastos prorrateados por valor (4 decimales). */
  entryCost: number;
}

export interface OrderPreview {
  lines: PreviewLine[];
  units: number;
  subtotal: number;
  igvAmount: number;
  total: number;
  expenses: number;
}

/**
 * Montos de la OC como los calcula el servidor: el IGV se separa solo si la empresa está afecta y los precios lo
 * incluyen; sin afectación no hay IGV y el costo es lo pagado. Los gastos NO suman al total (se reparten en el
 * costo de cada línea según su valor, o por unidades si todo vale 0).
 */
export function previewOrder(input: {
  lines: PreviewLineInput[];
  pricesIncludeIgv: boolean;
  igvAffected: boolean;
  expenses: number;
}): OrderPreview {
  const { lines, pricesIncludeIgv, igvAffected } = input;
  const expenses = roundTo(Number(input.expenses) || 0, 2);
  const splitIgv = igvAffected && pricesIncludeIgv;
  const entered = lines.map((line) => line.purchaseQuantity * line.unitPrice);
  const nets = entered.map((value) => (splitIgv ? value / (1 + IGV_RATE) : value));
  const quantities = lines.map((line) => line.purchaseQuantity * line.purchaseFactor);
  const totalNet = nets.reduce((sum, value) => sum + value, 0);
  const units = quantities.reduce((sum, value) => sum + value, 0);

  const subtotal = roundTo(totalNet, 2);
  let igvAmount = 0;
  let total = subtotal;
  if (igvAffected) {
    if (pricesIncludeIgv) {
      total = roundTo(entered.reduce((sum, value) => sum + value, 0), 2);
      igvAmount = roundTo(total - subtotal, 2);
    } else {
      igvAmount = roundTo(subtotal * IGV_RATE, 2);
      total = roundTo(subtotal + igvAmount, 2);
    }
  }

  const previewLines = lines.map((_, index) => {
    const quantity = quantities[index];
    const lineNet = nets[index];
    if (quantity <= 0) return { quantity, lineNet, unitCostNet: 0, entryCost: 0 };
    const share = totalNet > 0 ? lineNet / totalNet : units > 0 ? quantity / units : 0;
    return {
      quantity,
      lineNet,
      unitCostNet: roundTo(lineNet / quantity, 4),
      entryCost: roundTo(lineNet / quantity + (expenses * share) / quantity, 4),
    };
  });
  return { lines: previewLines, units, subtotal, igvAmount, total, expenses };
}

/* ---------------------------------------------------------------------------
   Formulario de la OC
--------------------------------------------------------------------------- */

export const MAX_ORDER_LINES = 200;
export const MAX_PURCHASE_QUANTITY = 10_000;
export const MAX_PURCHASE_FACTOR = 10_000;
export const MAX_PURCHASE_UNIT_LENGTH = 30;
const MAX_PRICE = 9_999_999_999;

/** Una línea del formulario: los números quedan como texto mientras se escriben. */
export interface OrderFormLine {
  variantId: string;
  /** «Polo · Talla: M» */
  label: string;
  sku: string;
  purchaseUnit: string;
  purchaseFactor: string;
  purchaseQuantity: string;
  unitPrice: string;
}

export interface OrderForm {
  supplierId: string;
  inventoryId: string;
  pricesIncludeIgv: boolean;
  receiptType: string;
  document: string;
  purchaseDate: string;
  notes: string;
  expenses: string;
  lines: OrderFormLine[];
}

export function emptyOrderForm(today: string = todayInLima()): OrderForm {
  return {
    supplierId: "",
    inventoryId: "",
    pricesIncludeIgv: false,
    receiptType: "FACTURA",
    document: "",
    purchaseDate: today,
    notes: "",
    expenses: "0",
    lines: [],
  };
}

const decimalsOf = (raw: string) => (raw.includes(".") ? raw.split(".")[1].length : 0);

/** Texto → número con hasta `decimals` decimales; `null` si no es válido. Acepta coma decimal. */
export function parseAmount(raw: string, decimals: number): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  if (decimalsOf(clean) > decimals) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value <= MAX_PRICE ? value : null;
}

/** Entero dentro de [min, max]; `null` si no lo es. */
export function parseWhole(raw: string, min: number, max: number): number | null {
  const clean = raw.trim();
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value >= min && value <= max ? value : null;
}

export interface ParsedLine {
  purchaseQuantity: number | null;
  purchaseFactor: number | null;
  unitPrice: number | null;
  problem: string | null;
}

export function parseOrderLine(line: OrderFormLine): ParsedLine {
  const purchaseQuantity = parseWhole(line.purchaseQuantity, 1, MAX_PURCHASE_QUANTITY);
  const purchaseFactor = parseWhole(line.purchaseFactor, 1, MAX_PURCHASE_FACTOR);
  const unitPrice = parseAmount(line.unitPrice, 4);
  let problem: string | null = null;
  if (purchaseQuantity === null) problem = `La cantidad va de 1 a ${MAX_PURCHASE_QUANTITY.toLocaleString("es-PE")}.`;
  else if (purchaseFactor === null) problem = `El factor de la unidad va de 1 a ${MAX_PURCHASE_FACTOR.toLocaleString("es-PE")}.`;
  else if (line.purchaseUnit.trim().length > MAX_PURCHASE_UNIT_LENGTH)
    problem = `La unidad de compra tiene hasta ${MAX_PURCHASE_UNIT_LENGTH} caracteres.`;
  else if (unitPrice === null) problem = "Revisa el precio: un número de 0 en adelante, con hasta 4 decimales.";
  return { purchaseQuantity, purchaseFactor, unitPrice, problem };
}

/** Vista previa del formulario (las líneas con errores cuentan como 0). */
export function previewForm(form: OrderForm, igvAffected: boolean): OrderPreview {
  return previewOrder({
    lines: form.lines.map((line) => {
      const parsed = parseOrderLine(line);
      return {
        purchaseQuantity: parsed.purchaseQuantity ?? 0,
        purchaseFactor: parsed.purchaseFactor ?? 1,
        unitPrice: parsed.unitPrice ?? 0,
      };
    }),
    pricesIncludeIgv: form.pricesIncludeIgv,
    igvAffected,
    expenses: parseAmount(form.expenses || "0", 2) ?? 0,
  });
}

/** Qué falta para guardar (`null` = se puede guardar). */
export function orderFormProblem(form: OrderForm): string | null {
  if (!form.supplierId) return "Elige el proveedor.";
  if (!form.inventoryId) return "Elige a qué almacén llega.";
  if (form.lines.length === 0) return "Agrega al menos un producto.";
  if (form.lines.length > MAX_ORDER_LINES) return `Una orden de compra tiene hasta ${MAX_ORDER_LINES} líneas.`;
  if (parseAmount(form.expenses || "0", 2) === null) return "Revisa los gastos: un monto de 0 en adelante, con hasta 2 decimales.";
  const bad = form.lines.find((line) => parseOrderLine(line).problem);
  if (bad) return `${bad.label}: ${parseOrderLine(bad).problem}`;
  return null;
}

const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** Cuerpo del POST/PUT. Sin montos: los calcula el servidor. */
export function buildOrderBody(form: OrderForm): SavePurchaseOrderBody {
  const lines: PurchaseOrderLineInput[] = form.lines.map((line) => {
    const parsed = parseOrderLine(line);
    const purchaseFactor = parsed.purchaseFactor ?? 1;
    const unit = blankToNull(line.purchaseUnit);
    return {
      variantId: line.variantId,
      purchaseQuantity: parsed.purchaseQuantity ?? 0,
      purchaseFactor,
      // «Unidad» con factor 1 es lo mismo que no tener unidad de compra.
      purchaseUnit: purchaseFactor === 1 && unit?.toLowerCase() === "unidad" ? null : unit,
      unitPrice: parsed.unitPrice ?? 0,
    };
  });
  return {
    supplierId: form.supplierId,
    inventoryId: form.inventoryId,
    pricesIncludeIgv: form.pricesIncludeIgv,
    expenses: parseAmount(form.expenses || "0", 2) ?? 0,
    document: blankToNull(form.document),
    notes: blankToNull(form.notes),
    purchaseDate: blankToNull(form.purchaseDate),
    receiptType: blankToNull(form.receiptType),
    lines,
  };
}

/** Un BORRADOR guardado, de vuelta al formulario para editarlo. */
export function formFromOrder(order: PurchaseOrder): OrderForm {
  return {
    supplierId: order.supplierId ?? "",
    inventoryId: order.inventoryId,
    pricesIncludeIgv: order.pricesIncludeIgv,
    receiptType: order.receiptType ?? "",
    document: order.document ?? "",
    purchaseDate: order.purchaseDate ? order.purchaseDate.slice(0, 10) : "",
    notes: order.notes ?? "",
    expenses: order.expenses !== undefined ? String(order.expenses) : "0",
    lines: order.lines.map((line) => ({
      variantId: line.variantId,
      label: lineLabel(line),
      sku: line.sku,
      purchaseUnit: line.purchaseUnit ?? "",
      purchaseFactor: String(line.purchaseFactor || 1),
      purchaseQuantity: String(line.purchaseQuantity || line.quantity || 1),
      unitPrice: line.unitPrice !== undefined && line.unitPrice !== null ? String(line.unitPrice) : "0",
    })),
  };
}

/** Suma variantes nuevas (las que ya están en la OC no se repiten: una línea por variante). */
export function addFormLines(form: OrderForm, lines: OrderFormLine[]): { form: OrderForm; added: number } {
  const present = new Set(form.lines.map((line) => line.variantId));
  const fresh = lines.filter((line) => !present.has(line.variantId));
  return { form: { ...form, lines: [...form.lines, ...fresh] }, added: fresh.length };
}

/* ---------------------------------------------------------------------------
   Recepción parcial (H3-D11)
--------------------------------------------------------------------------- */

export interface ReceiveDraftLine {
  itemId: string;
  variantId: string;
  label: string;
  sku: string;
  ordered: number;
  received: number;
  pending: number;
  /** Lo que se recibe ahora, como texto (lo que tipea el usuario). */
  quantity: string;
}

/** `fill: "pending"` (escritorio) empieza con todo lo pendiente; `"zero"` (escaneando) empieza en 0. */
export function receiveDraft(order: Pick<PurchaseOrder, "lines">, fill: "pending" | "zero"): ReceiveDraftLine[] {
  return order.lines.map((line) => {
    const pending = Math.max(0, Number(line.pendingQuantity ?? (line.quantity - line.receivedQuantity)) || 0);
    return {
      itemId: line.id,
      variantId: line.variantId,
      label: lineLabel(line),
      sku: line.sku,
      ordered: Number(line.quantity) || 0,
      received: Number(line.receivedQuantity) || 0,
      pending,
      quantity: fill === "pending" ? String(pending) : "0",
    };
  });
}

export function setReceiveQuantity(draft: ReceiveDraftLine[], itemId: string, quantity: string): ReceiveDraftLine[] {
  return draft.map((line) => (line.itemId === itemId ? { ...line, quantity } : line));
}

export const fillPending = (draft: ReceiveDraftLine[]): ReceiveDraftLine[] =>
  draft.map((line) => ({ ...line, quantity: String(line.pending) }));

/** Lo que se recibe ahora en una línea (`null` si el texto no es un entero ≥ 0). */
export function receiveQuantity(line: ReceiveDraftLine): number | null {
  const clean = line.quantity.trim();
  if (clean === "") return 0;
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

/** Por qué la línea no se puede enviar; `null` si está bien. */
export function receiveLineProblem(line: ReceiveDraftLine): string | null {
  const quantity = receiveQuantity(line);
  if (quantity === null) return "Escribe un número entero.";
  if (quantity > line.pending) return `No puedes recibir más de lo pendiente (${line.pending}).`;
  return null;
}

export const receiveTotal = (draft: ReceiveDraftLine[]): number =>
  draft.reduce((sum, line) => sum + (receiveQuantity(line) ?? 0), 0);

export const receiveDraftValid = (draft: ReceiveDraftLine[]): boolean =>
  draft.every((line) => receiveLineProblem(line) === null) && receiveTotal(draft) > 0;

/** Solo las líneas con algo por recibir ahora. */
export function buildReceiveLines(draft: ReceiveDraftLine[]): Array<{ itemId: string; quantity: number }> {
  return draft
    .map((line) => ({ itemId: line.itemId, quantity: receiveQuantity(line) ?? 0 }))
    .filter((line) => line.quantity > 0);
}

export type ReceiveScanOutcome =
  | { kind: "added"; itemId: string }
  | { kind: "not_found" }
  | { kind: "not_in_order" }
  | { kind: "line_complete"; itemId: string };

/** Un escaneo suma 1 a la primera línea de esa variante que todavía tiene pendiente. */
export function resolveReceiveScan(matches: Pick<VariantCodeMatch, "variantId">[], draft: ReceiveDraftLine[]): ReceiveScanOutcome {
  if (matches.length === 0) return { kind: "not_found" };
  const ids = new Set(matches.map((match) => match.variantId.toLowerCase()));
  const lines = draft.filter((line) => ids.has(line.variantId.toLowerCase()));
  if (lines.length === 0) return { kind: "not_in_order" };
  const open = lines.find((line) => (receiveQuantity(line) ?? 0) < line.pending);
  if (!open) return { kind: "line_complete", itemId: lines[0].itemId };
  return { kind: "added", itemId: open.itemId };
}

export function addOneToLine(draft: ReceiveDraftLine[], itemId: string): ReceiveDraftLine[] {
  return draft.map((line) => (line.itemId === itemId ? { ...line, quantity: String((receiveQuantity(line) ?? 0) + 1) } : line));
}

export function receiveScanMessage(outcome: ReceiveScanOutcome, code: string, line?: ReceiveDraftLine): string {
  switch (outcome.kind) {
    case "not_found":
      return `El código ${code} no es de ningún producto de tu catálogo.`;
    case "not_in_order":
      return `El código ${code} no es de esta compra.`;
    case "line_complete":
      return `Ya tienes todo lo pendiente de ${line?.label ?? "ese producto"}.`;
    default:
      return "";
  }
}

/* ---------------------------------------------------------------------------
   Varios
--------------------------------------------------------------------------- */

/** uuid v4 para el `operationId` de cada envío (idempotencia). */
export function newOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Estado HTTP de un error de axios (o `undefined`). */
export const httpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;
