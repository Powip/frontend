import type { SunatDocument } from "./sunat-document.model";
import type { SunatDocumentBulkError } from "./sunat-document-bulk-error.model";

export type SunatDocumentBulkResult = SunatDocument | SunatDocumentBulkError;

export interface CreateSunatDocumentsResult {
  results: SunatDocumentBulkResult[];
}
