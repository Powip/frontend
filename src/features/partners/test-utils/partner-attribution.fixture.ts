import type { PartnerAttributionResponseDto } from "../dto/partner-attribution-response.dto";

export const ATTRIBUTION_USER_A = "11111111-1111-4111-8111-111111111111";
export const ATTRIBUTION_USER_B = "22222222-2222-4222-8222-222222222222";

export function buildAttributionDto(overrides: Partial<PartnerAttributionResponseDto> = {}): PartnerAttributionResponseDto {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    companyId: "44444444-4444-4444-8444-444444444444",
    claimId: "55555555-5555-4555-8555-555555555555",
    state: "CONFIRMED",
    source: "LINK",
    reason: "FIRST_VALID_CLAIM",
    capturedAt: "2026-10-01T12:00:00Z",
    expiresAt: "2026-11-30T12:00:00Z",
    companyCreatedAt: "2026-10-02T12:00:00Z",
    confirmedAt: "2026-10-03T12:00:00.123456Z",
    resolutionVersion: 1,
    ...overrides,
  };
}
