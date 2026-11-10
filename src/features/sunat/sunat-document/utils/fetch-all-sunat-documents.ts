import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { ListSunatDocumentsResponseDto } from "../dto/list-sunat-documents-response.dto";
import { toListSunatDocumentsResult } from "../mappers/to-list-sunat-documents.mapper";
import type { SunatDocument } from "../models/sunat-document.model";

/**
 * Trae todos los comprobantes del negocio, página por página (100 por vez). Lo comparten la pantalla de
 * Facturación y la advertencia al anular un pedido, que usan la misma consulta en caché.
 */
export async function fetchAllSunatDocuments(signal?: AbortSignal): Promise<SunatDocument[]> {
  const byId = new Map<string, SunatDocument>();
  let offset = 0;
  while (true) {
    const response = await axiosAuth.get<ListSunatDocumentsResponseDto>(
      `${API.sunat}/api/v1/sunat-documents`,
      { params: { limit: 100, offset }, signal },
    );
    const page = toListSunatDocumentsResult(response.data);
    for (const document of page.documents) {
      byId.set(document.id, document);
    }
    offset += page.documents.length;
    if (offset >= page.total) break;
    if (page.documents.length === 0) throw new Error("Respuesta incompleta de comprobantes");
  }
  return [...byId.values()];
}
