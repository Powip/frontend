import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

/** Shown in the "N° comprobante" column when the receipt was not issued. */
export const SIN_NUMERO_COMPROBANTE = "—";

/**
 * Receipt number (series-correlative, e.g. B002-00000015) only once SUNAT
 * accepted it. A pending, rejected or missing document has no valid number
 * yet, so the table shows "—".
 */
export function getNumeroComprobanteEmitido(row: TaxDocumentRow): string {
  const taxDocument = row.taxDocument;

  if (!taxDocument) {
    return SIN_NUMERO_COMPROBANTE;
  }

  const accepted =
    taxDocument.cdrStatus === "ACCEPTED" || taxDocument.cdrStatus === "ACCEPTED_WITH_OBSERVATION";

  if (!accepted || !taxDocument.series || !taxDocument.correlative) {
    return SIN_NUMERO_COMPROBANTE;
  }

  return `${taxDocument.series}-${taxDocument.correlative}`;
}
