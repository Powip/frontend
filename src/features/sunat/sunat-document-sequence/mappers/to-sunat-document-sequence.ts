import type { SunatDocumentSequenceResponseDto } from "../dto/sunat-document-sequence-response.dto";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";

export function toSunatDocumentSequence(
  dto: SunatDocumentSequenceResponseDto,
): SunatDocumentSequence {
  return {
    companyId: dto.companyId,
    rucIssuer: dto.rucIssuer,
    taxDocumentType: dto.taxDocumentType,
    series: dto.series,
    nextCorrelative: dto.nextCorrelative,
    isDefault: dto.isDefault,
  };
}
