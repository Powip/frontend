import type { OlvaIdentityDocumentType } from "../../shared/constants/olva-enums.constants";

// GET /olva/person/:docType/:docNumber?role -> 200 (404 "Persona no encontrada" when unknown)
export interface OlvaPersonResponseDto {
  documentNumber: string;
  documentType: OlvaIdentityDocumentType;
  fullName: string | null;
  firstNames: string | null;
  lastNamePaternal: string | null;
  lastNameMaternal: string | null;
  phone: string | null;
  contributorStatus: string | null;
  existsInOlva: boolean;
}
