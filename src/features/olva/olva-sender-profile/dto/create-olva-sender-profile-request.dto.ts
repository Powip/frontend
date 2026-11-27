import type { OlvaSenderDocumentType } from "../constants/olva-sender-profile.constants";

export interface CreateOlvaSenderProfileRequestDto {
  label: string;
  documentType: OlvaSenderDocumentType;
  documentNumber: string;
  email: string;
  firstNames: string;
  lastName: string;
  phone?: string;
  isDefault?: boolean;
}
