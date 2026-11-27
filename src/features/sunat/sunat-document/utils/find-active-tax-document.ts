import type { SunatDocument } from "../models/sunat-document.model";
import { isDocumentInForce, isPrepaymentDocument } from "./prepayments";

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
