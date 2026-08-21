import type { DownloadFileResult } from "@/types/download-file.types";
import { createSunatDocumentsBulkPdfZipApi } from "../api/sunat-document.api";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";

export async function createSunatDocumentsBulkPdfZip(
  requestDto: BulkPdfRequestDto,
): Promise<DownloadFileResult> {
  return createSunatDocumentsBulkPdfZipApi(requestDto);
}
