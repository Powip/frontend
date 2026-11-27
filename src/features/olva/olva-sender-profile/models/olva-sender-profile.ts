import type { OlvaSenderDocumentType } from "../constants/olva-sender-profile.constants";

export interface OlvaSenderProfile {
  id: string;
  label: string;
  /** RUC for a business, DNI for a person (FEAT-35). */
  documentType: OlvaSenderDocumentType;
  documentNumber: string;
  email: string;

  firstNames: string | null;
  lastName: string | null;
  phone: string | null;

  businessName: string | null;

  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}
