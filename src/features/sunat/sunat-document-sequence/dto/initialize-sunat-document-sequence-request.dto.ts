import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface InitializeSunatDocumentSequenceRequestDto {
  taxDocumentType: SunatDocumentType;
  series: string;
  lastCorrelative: number;
}
