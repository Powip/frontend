import type { OlvaIdentityDocumentType } from "../../shared/constants/olva-enums.constants";
import { OLVA_DOCUMENT_NUMBER_LENGTH } from "../constants/olva-person.constants";

/** DNI: 8 digits. RUC: 11 digits. Only the shape, not the check digit (Olva decides that). */
export function isValidOlvaDocumentNumber(
  documentType: OlvaIdentityDocumentType,
  documentNumber: string,
): boolean {
  return new RegExp(`^\\d{${OLVA_DOCUMENT_NUMBER_LENGTH[documentType]}}$`).test(documentNumber);
}
