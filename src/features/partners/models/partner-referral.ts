import type { ReferralOrigin } from "./referral-origin.enum";
import type { ReferralStatus } from "./referral-status.enum";

export interface PartnerReferral {
  id: string;
  businessName: string;
  origin: ReferralOrigin;
  status: ReferralStatus;
  registeredAt: string;
  planName: string | null;
  firstMonthCommission: number | null;
  recurringCommission: number | null;
}
