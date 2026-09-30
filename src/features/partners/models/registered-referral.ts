import type { ReferralOrigin } from "./referral-origin.enum";
import type { ReferralStatus } from "./referral-status.enum";

export interface RegisteredReferral {
  id: string;
  origin: ReferralOrigin;
  status: ReferralStatus;
  registeredAt: string;
  expiresAt: string | null;
}
