import {
  OLVA_IDENTITY_DOCUMENT_TYPES,
  type OlvaIdentityDocumentType,
} from "@/features/olva/shared/constants/olva-enums.constants";

const RUC_LENGTH = 11;

/** A customer document with 11 digits is a RUC; anything else is treated as a DNI. */
export function getOlvaDocumentType(
  documentNumber: string | null | undefined,
): OlvaIdentityDocumentType {
  const digits = (documentNumber ?? "").replace(/\D/g, "");

  return digits.length === RUC_LENGTH
    ? OLVA_IDENTITY_DOCUMENT_TYPES.RUC
    : OLVA_IDENTITY_DOCUMENT_TYPES.DNI;
}
