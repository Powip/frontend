import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface GetSunatDocumentSequenceQuery {
  taxDocumentType: SunatDocumentType;
  series: string;

  /**
   * Issuer SUNAT profile (RUC). Omitted = the company's default profile.
   */
  sunatProfileId?: string;
}
