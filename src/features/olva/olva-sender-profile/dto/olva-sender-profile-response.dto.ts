import type { OlvaSenderDocumentType } from "../constants/olva-sender-profile.constants";

export interface OlvaSenderProfileResponseDto {
  id: string;
  label: string;
  /** RUC for a business, DNI for a person (FEAT-35). */
  documentType: OlvaSenderDocumentType;
  documentNumber: string;
  email: string;

  // Null only on profiles created before these fields existed: complete them with PATCH
  firstNames: string | null;
  lastName: string | null;
  phone: string | null;

  // Name Olva reported when the document was verified (business or person)
  businessName: string | null;

  isDefault: boolean;

  createdAt: string;
  updatedAt: string;
}
