import { useMutation } from "@tanstack/react-query";
import { getSunatDocumentPdf } from "../services/get-sunat-document-pdf.service";

export function useSunatDocumentPdf() {
  return useMutation<Blob, Error, string>({
    mutationFn: getSunatDocumentPdf,
  });
}
