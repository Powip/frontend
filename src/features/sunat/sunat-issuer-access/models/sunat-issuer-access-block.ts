import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";
import type { SunatIssuerAccessBlockCategory } from "../dto/sunat-issuer-access-block-response.dto";

/**
 * "SUNAT is refusing this RUC for this document type." SUNAT answered
 * before looking at any document: the SOL credentials are wrong, or the SOL
 * user / RUC has no permission to send electronic vouchers. It is per
 * document type because it can affect only some of them (e.g. sales
 * receipts are accepted while invoices are refused).
 */
export interface SunatIssuerAccessBlock {
  sunatProfileId: string | null;
  rucIssuer: string;
  razonSocial: string | null;
  /** SOL user the profile sends with (never the password). */
  solUser: string | null;
  taxDocumentType: SunatDocumentType;
  category: SunatIssuerAccessBlockCategory;
  sunatCode: string | null;
  /** SUNAT's own words. */
  sunatMessage: string;
  blockedAt: Date;
  lastFailedAt: Date;
  /** Documents waiting unsent, with their number kept. */
  heldDocuments: number;
}
