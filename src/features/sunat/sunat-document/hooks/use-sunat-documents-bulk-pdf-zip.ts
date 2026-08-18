import { useMutation } from "@tanstack/react-query";

import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";
import { createSunatDocumentsBulkPdfZip } from "../services/create-sunat-documents-bulk-pdf-zip.service";

export function useSunatDocumentsBulkPdfZip() {
  return useMutation<Blob, Error, BulkPdfRequestDto>({
    mutationFn: createSunatDocumentsBulkPdfZip,
  });
}
