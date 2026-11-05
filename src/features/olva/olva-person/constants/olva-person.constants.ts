import {
  OLVA_IDENTITY_DOCUMENT_TYPES,
  type OlvaIdentityDocumentType,
} from "../../shared/constants/olva-enums.constants";

export const OLVA_DOCUMENT_NUMBER_LENGTH: Record<OlvaIdentityDocumentType, number> = {
  [OLVA_IDENTITY_DOCUMENT_TYPES.DNI]: 8,
  [OLVA_IDENTITY_DOCUMENT_TYPES.RUC]: 11,
};
