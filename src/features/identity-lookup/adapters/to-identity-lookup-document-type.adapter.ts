import {
  IDENTITY_DOCUMENT_TYPES,
  type IdentityDocumentType,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import type { IdentityLookupDocumentType } from "../enums/identity-lookup.enums";
import { IDENTITY_LOOKUP_DOCUMENT_TYPES } from "../enums/identity-lookup.enums";

/**
 * The tax document's "Tipo Doc." field uses SUNAT catalog 06
 * (IDENTITY_DOCUMENT_TYPES: DNI/CE/RUC/Pasaporte, numeric codes) because
 * that's what SUNAT expects on the invoice payload. The identity-lookup
 * backend only knows how to resolve two of those four - RENIEC covers DNI,
 * SUNAT's padrón covers RUC; there's no equivalent public registry lookup
 * for Carnet de Extranjería or Pasaporte.
 *
 * This is the one place that bridges the two type systems. Returns null
 * for CE/Pasaporte (or an unset value) to mean "lookup isn't available for
 * this document type" - callers should fall back to a disabled/ProximamenteButton
 * state rather than attempt a call that can never succeed.
 */
export function toIdentityLookupDocumentType(
  sunatIdentityDocumentType: IdentityDocumentType | null | undefined,
): IdentityLookupDocumentType | null {
  switch (sunatIdentityDocumentType) {
    case IDENTITY_DOCUMENT_TYPES.DNI:
      return IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI;
    case IDENTITY_DOCUMENT_TYPES.RUC:
      return IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC;
    default:
      return null;
  }
}
