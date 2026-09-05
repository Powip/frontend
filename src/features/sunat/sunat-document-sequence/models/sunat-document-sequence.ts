import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export interface SunatDocumentSequence {
  companyId: string;
  rucIssuer: string;
  taxDocumentType: SunatDocumentType;
  series: string;
  nextCorrelative: number;

  /**
   * Whether this is the series used to issue documents of `taxDocumentType`
   * when the caller doesn't explicitly choose one. At most one sequence can
   * be default per `taxDocumentType` for the company's default SUNAT
   * issuer - enforced backend-side, mirrored here read-only.
   */
  isDefault: boolean;
}
