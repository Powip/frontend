import type { IdentityLookupResponseDto } from "../dto/identity-lookup-response.dto";
import type { LookupIdentityQueryDto } from "../dto/lookup-identity-query.dto";
import { IDENTITY_LOOKUP_DOCUMENT_TYPES } from "../enums/identity-lookup.enums";

// Plain data builders with no MSW import, so unit tests (jsdom) and Storybook handlers share them.
// `fetchedAt` is fixed on purpose: a `new Date()` here would make stories and snapshots non-deterministic.

/** A person resolved by DNI: only the name is known, every SUNAT-only field is null. */
export function buildDniLookupResponse(
  overrides: Partial<IdentityLookupResponseDto> = {},
): IdentityLookupResponseDto {
  return {
    documentType: IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI,
    documentNumber: "12345678",
    fullName: "MARIA FERNANDA QUISPE ROJAS",
    tradeName: null,
    status: null,
    condition: null,
    address: null,
    ubigeo: null,
    district: null,
    province: null,
    department: null,
    fetchedAt: "2026-10-01T15:00:00.000Z",
    ...overrides,
  };
}

/** A company resolved by RUC, with the full SUNAT taxpayer record. */
export function buildRucLookupResponse(
  overrides: Partial<IdentityLookupResponseDto> = {},
): IdentityLookupResponseDto {
  return {
    documentType: IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC,
    documentNumber: "20616141971",
    fullName: "Comercial Los Andes S.A.C.",
    tradeName: "Los Andes",
    status: "ACTIVO",
    condition: "HABIDO",
    address: "AV. JAVIER PRADO ESTE 1234",
    ubigeo: "150101",
    district: "LIMA",
    province: "LIMA",
    department: "LIMA",
    fetchedAt: "2026-10-01T15:00:00.000Z",
    ...overrides,
  };
}

/** Picks the DNI or RUC shape from the same query the real endpoint receives. */
export function buildIdentityLookupResponse(
  query: LookupIdentityQueryDto,
): IdentityLookupResponseDto {
  const overrides = { documentNumber: query.documentNumber };

  return query.documentType === IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC
    ? buildRucLookupResponse(overrides)
    : buildDniLookupResponse(overrides);
}
