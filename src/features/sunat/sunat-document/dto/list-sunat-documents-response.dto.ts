import type { SunatDocumentResponseDto } from "./sunat-documents-response.dto";

export interface ListSunatDocumentsResponseDto {
  items: SunatDocumentResponseDto[];

  total: number;

  limit: number;

  offset: number;
}
