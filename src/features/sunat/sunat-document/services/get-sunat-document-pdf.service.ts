import { getSunatDocumentPdfApi } from "../api/sunat-document.api";

export async function getSunatDocumentPdf(id: string): Promise<Blob> {
  return getSunatDocumentPdfApi(id);
}
