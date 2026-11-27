import type {
  OlvaIdentityDocumentType,
  OlvaPersonRole,
} from "../../shared/constants/olva-enums.constants";

export interface OlvaPersonLookup {
  documentType: OlvaIdentityDocumentType;
  documentNumber: string;
  role?: OlvaPersonRole;
}
