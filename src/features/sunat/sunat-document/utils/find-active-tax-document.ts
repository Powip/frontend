import { SUNAT_DOCUMENT_TYPES } from "../enums/sunat-document.enums";
import type { SunatDocument } from "../models/sunat-document.model";

const ACTIVE_STATUSES: readonly string[] = ["PENDING", "ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];
const CENT = 0.01;

const grandTotalOf = (document: SunatDocument): number =>
  Number(document.taxDocumentPayload?.totals?.grandTotal) || 0;

/**
 * Factura o boleta vigente de un pedido (aceptada por SUNAT o en proceso) que no fue anulada del todo por
 * notas de crédito. Es la misma regla que aplica el servicio de comprobantes al impedir emitir dos veces.
 */
export function findActiveTaxDocument(documents: readonly SunatDocument[]): SunatDocument | null {
  const creditNotes = documents.filter(
    (document) =>
      document.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE &&
      ACTIVE_STATUSES.includes(document.cdrStatus),
  );

  for (const document of documents) {
    const isInvoiceOrReceipt =
      document.taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE ||
      document.taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT;
    if (!isInvoiceOrReceipt || !ACTIVE_STATUSES.includes(document.cdrStatus)) continue;

    const credited = creditNotes
      .filter((note) => note.referenceDocumentId === document.id)
      .reduce((sum, note) => sum + grandTotalOf(note), 0);

    if (credited + CENT < grandTotalOf(document)) return document;
  }

  return null;
}
