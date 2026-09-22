import { PARTNER_REFERRALS_MOCK } from "../mocks/partner-referrals.mock";
import type { PartnerReferral } from "../models/partner-referral";

export async function getRecentReferrals(limit: number): Promise<PartnerReferral[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PARTNER_REFERRALS_MOCK.slice(0, limit);
}
