export type ReferralOriginDto = "LINK" | "CODE" | "MANUAL";

export interface PartnerReferralResponseDto {
  id: string;
  businessLabel: string;
  contactLabel?: string | null;
  origin: ReferralOriginDto;
  state: string;
  capturedAt: string;
  expiresAt?: string | null;
  companyState?: string | null;
  planLabel?: string | null;
}

export interface PartnerReferralPageResponseDto {
  items: PartnerReferralResponseDto[];
  nextCursor: string | null;
}
