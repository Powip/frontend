import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

/**
 * Mirrors `sunatDocumentSequenceResponseSchema` in the sunat-integration
 * backend (presentation/http/dto/sunat-document-sequence/sunat-document-sequence-response.dto.ts).
 *
 * `nextCorrelative` and `isDefault` must stay in sync with that schema's
 * types (number / boolean respectively) - a previous version of this DTO
 * typed `nextCorrelative` as `string` and omitted `isDefault` entirely,
 * which silently broke `Number()` coercions downstream and made it
 * impossible to render/act on which series is the default one.
 */
export interface SunatDocumentSequenceResponseDto {
  companyId: string;
  rucIssuer: string;
  taxDocumentType: SunatDocumentType;
  series: string;
  nextCorrelative: number;
  isDefault: boolean;
}
