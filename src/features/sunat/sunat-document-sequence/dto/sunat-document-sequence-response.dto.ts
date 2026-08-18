import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface SunatDocumentSequenceResponseDto {
  companyId: string;
  rucIssuer: string;
  taxDocumentType: SunatDocumentType;
  series: string;
  nextCorrelative: string;
}
