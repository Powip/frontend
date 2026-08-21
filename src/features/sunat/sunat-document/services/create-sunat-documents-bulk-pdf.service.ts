import type { DownloadFileResult } from "@/types/download-file.types";
import { createSunatDocumentsBulkPdfApi } from "../api/sunat-document.api";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";

export async function createSunatDocumentsBulkPdf(
  requestDto: BulkPdfRequestDto,
): Promise<DownloadFileResult> {
  return createSunatDocumentsBulkPdfApi(requestDto);
}
