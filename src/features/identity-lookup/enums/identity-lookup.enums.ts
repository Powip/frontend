/**
 * Document types the identity-lookup feature can resolve.
 *
 * Deliberately NOT the same type as IDENTITY_DOCUMENT_TYPES in
 * features/sunat/sunat-document/enums/sunat-document.enums.ts - that one
 * holds SUNAT catalog 06 codes ("1", "4", "6", "7" for DNI/CE/RUC/Pasaporte)
 * used on the tax document payload. This one is a plain "DNI" | "RUC"
 * discriminator matching the identity-lookup backend's contract. Mixing
 * the two up compiles fine (different files, same-shaped strings in one
 * case) but is wrong - see adapters/to-identity-lookup-document-type.adapter.ts
 * for the one place they're deliberately bridged.
 */
export const IDENTITY_LOOKUP_DOCUMENT_TYPES = {
  DNI: "DNI",
  RUC: "RUC",
} as const;

export type IdentityLookupDocumentType =
  (typeof IDENTITY_LOOKUP_DOCUMENT_TYPES)[keyof typeof IDENTITY_LOOKUP_DOCUMENT_TYPES];
