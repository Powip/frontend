/** The receipt is a confirmed sale snapshot, never a lookup of today's stock. */
export interface PrintableReceiptItem {
  quantity: number;
  trackingMode?: string;
  unitIds?: string[];
  units?: { id: string; code: string; status: string }[];
}

export interface PrintableReceiptTracking {
  status?: string;
  unitAssignmentStatus?: string;
  unitCatalogValidated?: boolean;
  stockVersion?: number;
  confirmedStockVersion?: number | null;
  items?: readonly PrintableReceiptItem[];
}

export interface PrintDocumentOptions {
  isCurrent?: () => boolean;
  signal?: AbortSignal;
}

export interface PrintableUnitCodes {
  label: "IMEI" | "Serie" | "IMEI/serie";
  codes: string[];
  notice?: string;
}

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const tracked = (item: PrintableReceiptItem) =>
  item.trackingMode === "IMEI" || item.trackingMode === "SERIAL";
const uncertain = (item: PrintableReceiptItem) =>
  item.trackingMode === "UNKNOWN" ||
  (item.trackingMode !== "NONE" && Boolean(item.unitIds?.length || item.units?.length));

function validLine(item: PrintableReceiptItem, state: string): boolean {
  if (
    !tracked(item) ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity < 1 ||
    !Array.isArray(item.unitIds) ||
    !Array.isArray(item.units) ||
    item.unitIds.length !== item.quantity ||
    item.units.length !== item.quantity ||
    !item.unitIds.every(uuid)
  )
    return false;
  const ids = new Set(item.unitIds.map((id) => id.toLowerCase()));
  const codes = new Set<string>();
  if (ids.size !== item.quantity) return false;
  for (const unit of item.units) {
    if (
      !unit ||
      !uuid(unit.id) ||
      !ids.delete(unit.id.toLowerCase()) ||
      unit.status !== state ||
      typeof unit.code !== "string" ||
      !/^[A-Za-z0-9._/-]{1,100}$/.test(unit.code) ||
      (item.trackingMode === "IMEI" && !/^\d{15}$/.test(unit.code))
    )
      return false;
    const normalized = unit.code.toUpperCase();
    if (codes.has(normalized)) return false;
    codes.add(normalized);
  }
  return ids.size === 0;
}

export function getPrintableUnitCodes(
  receipt: PrintableReceiptTracking,
  item: PrintableReceiptItem,
): PrintableUnitCodes | null {
  // Quantity-only lines retain their old rendering, even if stray unit fields exist.
  if (item.trackingMode === "NONE" || (!tracked(item) && !uncertain(item))) return null;
  const label =
    item.trackingMode === "IMEI" ? "IMEI" : item.trackingMode === "SERIAL" ? "Serie" : "IMEI/serie";
  const pending = (): PrintableUnitCodes => ({
    label,
    codes: [],
    notice: "Códigos pendientes de confirmación.",
  });
  if (
    !tracked(item) ||
    receipt.unitCatalogValidated !== true ||
    receipt.unitAssignmentStatus !== "CONFIRMED" ||
    !Number.isSafeInteger(receipt.stockVersion) ||
    (receipt.stockVersion ?? 0) < 1 ||
    receipt.confirmedStockVersion !== receipt.stockVersion
  )
    return pending();
  const state =
    receipt.status === "ENTREGADO"
      ? "SOLD"
      : receipt.status === "ANULADO"
        ? "AVAILABLE"
        : "RESERVED";
  const lines = receipt.items ?? [item];
  const ids = new Set<string>(),
    codes = new Set<string>();
  for (const line of lines) {
    if (!tracked(line)) continue;
    if (!validLine(line, state))
      return {
        label,
        codes: [],
        notice: "Códigos no disponibles. Actualiza el comprobante.",
      };
    for (const unit of line.units ?? []) {
      if (ids.has(unit.id.toLowerCase()) || codes.has(unit.code.toUpperCase()))
        return {
          label,
          codes: [],
          notice: "Códigos no disponibles. Actualiza el comprobante.",
        };
      ids.add(unit.id.toLowerCase());
      codes.add(unit.code.toUpperCase());
    }
  }
  if (!validLine(item, state))
    return {
      label,
      codes: [],
      notice: "Códigos no disponibles. Actualiza el comprobante.",
    };
  return {
    label,
    codes: (item.units ?? []).map((unit) => unit.code),
    ...(receipt.status === "ANULADO"
      ? { notice: "Referencia histórica de la venta anulada." }
      : {}),
  };
}

export const escapePrintHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

export function renderPrintableUnitCodesHtml(
  receipt: PrintableReceiptTracking,
  item: PrintableReceiptItem,
): string {
  const value = getPrintableUnitCodes(receipt, item);
  if (!value) return "";
  return `<div class="unit-codes" style="margin-top:4px;font-size:10px;line-height:1.4;min-width:0;overflow-wrap:anywhere;word-break:break-word;white-space:normal;">${value.codes.map((code) => `<div class="unit-code" style="font-family:monospace;break-inside:avoid;page-break-inside:avoid;">${escapePrintHtml(value.label)}: ${escapePrintHtml(code)}</div>`).join("")}${value.notice ? `<div class="unit-code-notice">${escapePrintHtml(value.notice)}</div>` : ""}</div>`;
}
