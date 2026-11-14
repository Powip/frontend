import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface InitializeSunatDocumentSequenceRequestDto {
  taxDocumentType: SunatDocumentType;
  series: string;
  lastCorrelative: number;

  /**
   * Issuer SUNAT profile (RUC). Omitted = the company's default profile.
   */
  sunatProfileId?: string;
}
