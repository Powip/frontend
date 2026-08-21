import type { DownloadFileResult } from "@/types/download-file.types";
import { getSunatDocumentPdfApi } from "../api/sunat-document.api";

export async function getSunatDocumentPdf(id: string): Promise<DownloadFileResult> {
  return getSunatDocumentPdfApi(id);
}
