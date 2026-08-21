import { useMutation } from "@tanstack/react-query";
import type { DownloadFileResult } from "@/types/download-file.types";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";
import { createSunatDocumentsBulkPdf } from "../services/create-sunat-documents-bulk-pdf.service";

export function useSunatDocumentsBulkPdf() {
  return useMutation<DownloadFileResult, Error, BulkPdfRequestDto>({
    mutationFn: createSunatDocumentsBulkPdf,
  });
}
