import { useMutation } from "@tanstack/react-query";
import type { DownloadFileResult } from "@/types/download-file.types";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";
import { createSunatDocumentsBulkPdfZip } from "../services/create-sunat-documents-bulk-pdf-zip.service";

export function useSunatDocumentsBulkPdfZip() {
  return useMutation<DownloadFileResult, Error, BulkPdfRequestDto>({
    mutationFn: createSunatDocumentsBulkPdfZip,
  });
}
