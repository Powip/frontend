import { quotationStatus } from "@/components/quotations/quotationHelpers";
import type { ConversationQuote } from "@/types/crm";
import type { Quotation, QuotationLine } from "@/types/quotations";

/** «Últimas unidades» cuando la empresa no fijó su propio límite. */
const DEFAULT_LAST_UNITS = 3;

type StockLine = Pick<QuotationLine, "stockAvailable">;

/** Unidades que quedan si son pocas (según la regla de cierre); si no, null. */
export function lowStockOf(line: StockLine | undefined, lastUnits = DEFAULT_LAST_UNITS): number | null {
  const stock = line?.stockAvailable;
  return typeof stock === "number" && stock > 0 && stock <= lastUnits ? stock : null;
}

/** Texto del stock de la variante; null si no se conoce. */
export function stockText(line: StockLine, lastUnits = DEFAULT_LAST_UNITS): string | null {
  const stock = line.stockAvailable;
  if (typeof stock !== "number") return null;
  if (stock <= 0) return "agotado, ofrece una alternativa";
  return lowStockOf(line, lastUnits) ? `últimas ${stock}` : `${stock} en stock`;
}

/** ¿El POWIP Link todavía sirve para cobrar? */
export function isLinkAlive(link: ConversationQuote | undefined, quotation: Quotation | undefined): boolean {
  if (!link?.publicUrl || link.orderId) return false;
  const status = quotation ? quotationStatus(quotation) : link.status;
  return !status || status === "PREVENTA";
}
