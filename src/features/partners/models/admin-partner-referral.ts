import type { ReferralOrigin } from "./referral-origin.enum";
import type { ReferralStatus } from "./referral-status.enum";

export type BillingCycle = "mensual" | "anual";

export interface AdminPartnerReferral {
  id: string;
  businessName: string;
  origin: ReferralOrigin;
  registeredAt: string;
  planName: string | null;
  price: number;
  billingCycle: BillingCycle | null;
  status: ReferralStatus;
  firstMonthCommission: number | null;
  recurringCommission: number | null;
}
