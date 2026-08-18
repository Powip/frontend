import { listSunatDocumentsApi } from "../api/sunat-document.api";
import type { ListSunatDocumentsQueryDto } from "../dto/list-sunat-documents-query.dto";
import {
  type ListSunatDocumentsResult,
  toListSunatDocumentsResult,
} from "../mappers/to-list-sunat-documents.mapper";

export async function listSunatDocuments(
  query: ListSunatDocumentsQueryDto,
): Promise<ListSunatDocumentsResult> {
  const responseDto = await listSunatDocumentsApi(query);

  return toListSunatDocumentsResult(responseDto);
}
