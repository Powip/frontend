/** LINK evidence is not a manual referral, a payment or a commission. */
export interface PartnerAttribution {
  id: string;
  companyId: string;
  state: "CONFIRMED";
  source: "LINK";
  reason: "FIRST_VALID_CLAIM";
  capturedAt: string;
  expiresAt: string;
  companyCreatedAt: string;
  confirmedAt: string;
  resolutionVersion: number;
}

export interface PartnerAttributionPage {
  items: PartnerAttribution[];
  nextCursor: string | null;
}
