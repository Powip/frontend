import { createSunatDocumentsApi } from "../api/sunat-document.api";
import type { CreateSunatDocumentsRequestDto } from "../dto/create-sunat-documents-request.dto";
import type {
  CreateSunatDocumentsResponseDto,
  SunatDocumentBulkErrorResponseDto,
  SunatDocumentBulkResultResponseDto,
  SunatDocumentResponseDto,
} from "../dto/sunat-documents-response.dto";
import { toSunatDocument } from "../mappers/to-sunat-document.mapper";
import type { SunatDocument } from "../models/sunat-document.model";

export interface CreateSunatDocumentsResult {
  documents: SunatDocument[];
  errors: SunatDocumentBulkErrorResponseDto[];
}

function isSunatDocumentResponse(
  result: SunatDocumentBulkResultResponseDto,
): result is SunatDocumentResponseDto {
  return "id" in result;
}

function isSunatDocumentBulkError(
  result: SunatDocumentBulkResultResponseDto,
): result is SunatDocumentBulkErrorResponseDto {
  return "error" in result;
}

export async function createSunatDocuments(
  requestDto: CreateSunatDocumentsRequestDto,
): Promise<CreateSunatDocumentsResult> {
  const response: CreateSunatDocumentsResponseDto = await createSunatDocumentsApi(requestDto);

  return {
    documents: response.results.filter(isSunatDocumentResponse).map(toSunatDocument),

    errors: response.results.filter(isSunatDocumentBulkError),
  };
}
