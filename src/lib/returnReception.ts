import type {
  ReceivedReturnLine,
  ReceiveReturnBody,
  ReturnReception,
} from "@/services/warehousesService";
import type { VariantCodeMatch } from "@/services/variantCodesService";

// FEAT-24 H2-F — Inventario › Recepciones: recibir una devolución. Por cada
// producto que volvió, lo que reingresa a stock más la merma tiene que ser
// exactamente lo que volvió (así lo exige ms-logistics). Lógica pura.

export const MERMA_REASON_MAX = 200;

export interface ReceptionLineDraft {
  variantId: string;
  /** Lo que volvió. */
  quantity: number;
  reingreso: number;
  merma: number;
  /** Motivo de la merma (obligatorio si hay merma). */
  reason: string;
}

/** Un borrador por producto de la devolución (las líneas repetidas se suman), todo en 0. */
export function draftFromReception(reception: Pick<ReturnReception, "lines">): ReceptionLineDraft[] {
  const byVariant = new Map<string, ReceptionLineDraft>();
  for (const line of reception.lines ?? []) {
    const key = line.variantId.toLowerCase();
    const previous = byVariant.get(key);
    if (previous) previous.quantity += line.quantity;
    else byVariant.set(key, { variantId: line.variantId, quantity: line.quantity, reingreso: 0, merma: 0, reason: "" });
  }
  return [...byVariant.values()];
}

export const lineAssigned = (line: ReceptionLineDraft) => line.reingreso + line.merma;
export const lineRemaining = (line: ReceptionLineDraft) => line.quantity - lineAssigned(line);

const isCount = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Qué le falta a una línea para poder recibirse; `null` si está lista. */
export function lineProblem(line: ReceptionLineDraft): string | null {
  if (!isCount(line.reingreso) || !isCount(line.merma)) return "Las cantidades son números enteros desde 0.";
  const assigned = lineAssigned(line);
  if (assigned < line.quantity) {
    const missing = line.quantity - assigned;
    return `Falta${missing === 1 ? "" : "n"} ${missing} por asignar: reingreso + merma tiene que dar ${line.quantity}.`;
  }
  if (assigned > line.quantity) {
    const extra = assigned - line.quantity;
    return `Sobra${extra === 1 ? "" : "n"} ${extra}: volvieron ${line.quantity}.`;
  }
  if (line.merma > 0 && line.reason.trim() === "") return "Indica el motivo de la merma.";
  if (line.reason.trim().length > MERMA_REASON_MAX) return `El motivo admite hasta ${MERMA_REASON_MAX} caracteres.`;
  return null;
}

export function draftIsValid(lines: ReceptionLineDraft[]): boolean {
  return lines.length > 0 && lines.every((line) => lineProblem(line) === null);
}

/** Lee un campo de cantidad: vacío o inválido = 0; nunca negativo. */
export function parseCount(text: string): number {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function updateLine(
  lines: ReceptionLineDraft[],
  variantId: string,
  patch: Partial<Pick<ReceptionLineDraft, "reingreso" | "merma" | "reason">>,
): ReceptionLineDraft[] {
  return lines.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line));
}

/** «Lo que falta, a stock»: completa cada línea con reingreso (la merma ya puesta se respeta). */
export function fillRemainingAsReingreso(lines: ReceptionLineDraft[]): ReceptionLineDraft[] {
  return lines.map((line) => ({ ...line, reingreso: Math.max(0, line.quantity - line.merma) }));
}

/**
 * Cuerpo de `receive`: por producto, una línea de reingreso y/o una de merma
 * (con su motivo). El almacén solo viaja si el reingreso va a otro distinto del
 * del pedido (sin él, ms-logistics usa el del pedido).
 */
export function buildReceiveBody(
  lines: ReceptionLineDraft[],
  destinationInventoryId: string,
  originInventoryId: string,
): ReceiveReturnBody {
  const out: ReceiveReturnBody["lines"] = [];
  for (const line of lines) {
    if (line.reingreso > 0) out.push({ variantId: line.variantId, quantity: line.reingreso, result: "reingreso" });
    if (line.merma > 0)
      out.push({ variantId: line.variantId, quantity: line.merma, result: "merma", reason: line.reason.trim() });
  }
  const reingresa = out.some((line) => line.result === "reingreso");
  return {
    ...(reingresa && destinationInventoryId && destinationInventoryId !== originInventoryId
      ? { inventoryId: destinationInventoryId }
      : {}),
    lines: out,
  };
}

// ---------- Escaneo ----------

export type ScanOutcome =
  | { kind: "added"; variantId: string }
  /** El código no es de ningún producto de la empresa. */
  | { kind: "unknown" }
  /** Es un producto, pero no de esta devolución. */
  | { kind: "not_in_reception" }
  /** Es de esta devolución, pero ya está todo asignado. */
  | { kind: "line_complete"; variantId: string };

/** A qué línea suma un escaneo: la primera de la devolución con ese producto que todavía tenga pendiente. */
export function resolveScan(matches: VariantCodeMatch[], lines: ReceptionLineDraft[]): ScanOutcome {
  const ids = new Set(matches.map((match) => match.variantId.toLowerCase()));
  if (ids.size === 0) return { kind: "unknown" };
  const candidates = lines.filter((line) => ids.has(line.variantId.toLowerCase()));
  if (candidates.length === 0) return { kind: "not_in_reception" };
  const open = candidates.find((line) => lineRemaining(line) > 0);
  if (!open) return { kind: "line_complete", variantId: candidates[0].variantId };
  return { kind: "added", variantId: open.variantId };
}

/** Un escaneo suma 1 al reingreso de la línea. */
export function applyScan(lines: ReceptionLineDraft[], variantId: string): ReceptionLineDraft[] {
  return lines.map((line) => (line.variantId === variantId ? { ...line, reingreso: line.reingreso + 1 } : line));
}

export function scanErrorMessage(outcome: Exclude<ScanOutcome, { kind: "added" }>, code: string, label?: string): string {
  switch (outcome.kind) {
    case "unknown":
      return `El código ${code} no es de ningún producto de tu empresa.`;
    case "not_in_reception":
      return `El código ${code} no es de ningún producto pendiente de esta devolución.`;
    case "line_complete":
      return `${label ?? "Ese producto"} ya está completo: no quedan unidades pendientes en esta devolución.`;
  }
}

// ---------- Recibidas ----------

export interface ReceivedSummary {
  variantId: string;
  reingreso: number;
  merma: number;
  reasons: string[];
}

/** Lo recibido, agrupado por producto. */
export function summarizeReceived(lines: ReceivedReturnLine[] | null | undefined): ReceivedSummary[] {
  const byVariant = new Map<string, ReceivedSummary>();
  for (const line of lines ?? []) {
    const key = line.variantId.toLowerCase();
    const row = byVariant.get(key) ?? { variantId: line.variantId, reingreso: 0, merma: 0, reasons: [] };
    if (line.result === "merma") {
      row.merma += line.quantity;
      if (line.reason && line.reason.trim()) row.reasons.push(line.reason.trim());
    } else row.reingreso += line.quantity;
    byVariant.set(key, row);
  }
  return [...byVariant.values()];
}

/** En el alcance de una tienda, solo las devoluciones de sus almacenes; `null` = todo el negocio. */
export function receptionsInScope(receptions: ReturnReception[], inventoryIds: readonly string[] | null): ReturnReception[] {
  if (inventoryIds === null) return receptions;
  const allowed = new Set(inventoryIds);
  return receptions.filter((reception) => allowed.has(reception.inventoryId));
}

/** Todos los productos (ids) que hay que nombrar en la pantalla. */
export function receptionVariantIds(receptions: ReturnReception[]): string[] {
  const ids = new Set<string>();
  for (const reception of receptions) {
    for (const line of reception.lines ?? []) ids.add(line.variantId);
    for (const line of reception.receivedLines ?? []) ids.add(line.variantId);
  }
  return [...ids].sort();
}
