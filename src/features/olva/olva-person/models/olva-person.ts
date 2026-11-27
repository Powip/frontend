import type { OlvaIdentityDocumentType } from "../../shared/constants/olva-enums.constants";

export interface OlvaPerson {
  documentNumber: string;
  documentType: OlvaIdentityDocumentType;
  fullName: string | null;
  firstNames: string | null;
  lastNamePaternal: string | null;
  lastNameMaternal: string | null;
  phone: string | null;
  /** SUNAT contributor status (RUC lookups), e.g. "ACTIVO". */
  contributorStatus: string | null;
  /** True when Olva already has this person as a customer. */
  existsInOlva: boolean;
}
