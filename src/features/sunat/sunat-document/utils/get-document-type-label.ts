import { SUNAT_DOCUMENT_TYPE_LABELS } from "../enums/sunat-document.enums";
import type { TaxDocumentRow } from "../types/tax-document-row";

export function getDocumentTypeLabel(taxDocument: TaxDocumentRow["taxDocument"]): string {
  if (!taxDocument) {
    return "Comprobante";
  }

  return SUNAT_DOCUMENT_TYPE_LABELS[taxDocument.taxDocumentType] ?? "Comprobante Electrónico";
}
