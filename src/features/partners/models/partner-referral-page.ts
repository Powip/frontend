import type { PartnerReferral } from "./partner-referral";

export interface PartnerReferralPage {
  items: PartnerReferral[];
  nextCursor: string | null;
}
