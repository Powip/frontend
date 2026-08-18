import type { ListSunatDocumentsResponseDto } from "../dto/list-sunat-documents-response.dto";
import type { SunatDocument } from "../models/sunat-document.model";
import { toSunatDocument } from "./to-sunat-document.mapper";

export interface ListSunatDocumentsResult {
  documents: SunatDocument[];
  total: number;
  limit: number;
  offset: number;
}

export function toListSunatDocumentsResult(
  dto: ListSunatDocumentsResponseDto,
): ListSunatDocumentsResult {
  return {
    documents: dto.items.map(toSunatDocument),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}
