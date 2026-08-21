import { useMutation } from "@tanstack/react-query";
import type { DownloadFileResult } from "@/types/download-file.types";
import { getSunatDocumentPdf } from "../services/get-sunat-document-pdf.service";

export function useSunatDocumentPdf() {
  return useMutation<DownloadFileResult, Error, string>({
    mutationFn: getSunatDocumentPdf,
  });
}
