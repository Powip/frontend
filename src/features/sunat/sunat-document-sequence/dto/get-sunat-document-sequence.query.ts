import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface GetSunatDocumentSequenceQuery {
  taxDocumentType: SunatDocumentType;
  series: string;
}
