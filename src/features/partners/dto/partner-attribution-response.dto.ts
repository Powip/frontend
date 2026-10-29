export interface PartnerAttributionResponseDto {
  id: string;
  companyId: string;
  claimId: string;
  state: "CONFIRMED";
  source: "LINK";
  reason: "FIRST_VALID_CLAIM";
  capturedAt: string;
  expiresAt: string;
  companyCreatedAt: string;
  confirmedAt: string;
  resolutionVersion: number;
}

export interface PartnerAttributionPageResponseDto {
  items: PartnerAttributionResponseDto[];
  nextCursor: string | null;
}
