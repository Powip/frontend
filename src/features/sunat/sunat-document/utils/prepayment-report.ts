import type { TaxDocumentRow } from "../types/tax-document-row";

/**
 * Rows for the sales books: each anticipo of a sale becomes its own row (it
 * is its own comprobante), placed before the sale's final comprobante.
 */
export function expandPrepaymentRows(rows: readonly TaxDocumentRow[]): TaxDocumentRow[] {
  return rows.flatMap((row) => [
    ...(row.prepayments ?? []).map((prepayment) => ({ sale: row.sale, taxDocument: prepayment })),
    row,
  ]);
}

/**
 * Amounts of one book row. Anticipos and finals that deduct them use the
 * comprobante's own totals (the final's are net of the anticipos). Any other
 * comprobante keeps the sale total, as before.
 */
export function reportAmountsOf(row: TaxDocumentRow): {
  baseImponible: number;
  igv: number;
  total: number;
} {
  const payload = row.taxDocument?.taxDocumentPayload;

  if (payload && (payload.isPrepayment || (payload.prepayments?.length ?? 0) > 0)) {
    return {
      baseImponible: Number(payload.totals.subtotal) || 0,
      igv: Number(payload.totals.taxTotal) || 0,
      total: Number(payload.totals.grandTotal) || 0,
    };
  }

  const total = Number(row.sale.grandTotal);
  const baseImponible = total / 1.18;

  return { baseImponible, igv: total - baseImponible, total };
}
