import { createSunatDocumentsBulkPdfZipApi } from "../api/sunat-document.api";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";

export async function createSunatDocumentsBulkPdfZip(requestDto: BulkPdfRequestDto): Promise<Blob> {
  return createSunatDocumentsBulkPdfZipApi(requestDto);
}
