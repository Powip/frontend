import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

/**
 * Same shape as GetSunatDocumentSequenceQuery (taxDocumentType + series) -
 * this identifies an *existing* sequence to promote to default, it doesn't
 * describe a new one. Matches the backend's
 * `setDefaultSunatDocumentSequenceRequestSchema` 1:1.
 */
export interface SetDefaultSunatDocumentSequenceRequestDto {
  taxDocumentType: SunatDocumentType;
  series: string;
}
