import { CdrStatus, DocumentType } from "@/api/sunat/types/sunat-document.types";
import { SunatInvoicePayload } from "./sunat-invoice-payload";

export interface SunatDocument {
  id: string;
  externalId: string;
  companyId: string;
  documentType: DocumentType;
  series: string;
  correlative: string;
  issueDate: Date;
  rucEmisor: string;
  cdrStatus: CdrStatus;
  sunatCode: string | null;
  sunatDescription: string | null;
  observations: string | null;
  xmlUrl: string | null;
  cdrUrl: string | null;
  retryAttempts: number;
  invoicePayload: SunatInvoicePayload | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function fullNumberOf(taxDocument: SunatDocument): string {
  return `${taxDocument.series}-${taxDocument.correlative}`;
}

/**
 * Mirrors the backend's downloadPdf handler exactly:
 * `${taxDocument.ruc_emisor}-${taxDocument.document_type}-${taxDocument.series}-${taxDocument.correlative}`
 * — raw "01"/"03" code, no label, no re-padding (the correlative is
 * already stored/returned padded).
 */
export function buildComprobanteFileName(taxDocument: SunatDocument): string {
  return `${taxDocument.rucEmisor}-${taxDocument.documentType}-${taxDocument.series}-${taxDocument.correlative}`;
}
