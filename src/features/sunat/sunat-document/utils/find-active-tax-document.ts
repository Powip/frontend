import type { SunatDocument } from "../models/sunat-document.model";
import { SUNAT_DOCUMENT_TYPES } from "../enums/sunat-document.enums";
import { isDocumentInForce, isPrepaymentDocument } from "./prepayments";

const ACTIVE_STATUSES: readonly string[] = ["PENDING", "ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];

/**
 * Factura o boleta vigente de un pedido (aceptada por SUNAT o en proceso) que no fue anulada del todo por
 * notas de crédito. Es la misma regla que aplica el servicio de comprobantes al impedir emitir dos veces.
 *
 * Los anticipos no cuentan: un pedido puede tener varios anticipos y luego un comprobante final que los
 * descuenta (ese final puede quedar en S/ 0.00 y sigue vigente).
 */
export function findActiveTaxDocument(documents: readonly SunatDocument[]): SunatDocument | null {
  for (const document of documents) {
    if (isPrepaymentDocument(document)) continue;
    if (isDocumentInForce(document, documents)) return document;
  }

  return null;
}

/**
 * Facturas o boletas del pedido que SUNAT aceptó (o están en proceso) pero que las notas de crédito
 * anularon por completo. Ya no ocupan el pedido: se puede emitir un comprobante nuevo con el siguiente
 * correlativo. Usa la misma regla que `findActiveTaxDocument`.
 */
export function findCancelledTaxDocuments(documents: readonly SunatDocument[]): SunatDocument[] {
  return documents.filter(
    (document) =>
      !isPrepaymentDocument(document) &&
      (document.taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE ||
        document.taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT) &&
      ACTIVE_STATUSES.includes(document.cdrStatus) &&
      documents.some(
        (note) =>
          note.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE &&
          ACTIVE_STATUSES.includes(note.cdrStatus) &&
          note.referenceDocumentId === document.id,
      ) &&
      !isDocumentInForce(document, documents),
  );
}
