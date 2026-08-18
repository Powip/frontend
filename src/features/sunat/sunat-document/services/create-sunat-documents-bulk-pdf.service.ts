import { createSunatDocumentsBulkPdfApi } from "../api/sunat-document.api";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";

export async function createSunatDocumentsBulkPdf(requestDto: BulkPdfRequestDto): Promise<Blob> {
  return createSunatDocumentsBulkPdfApi(requestDto);
}
