import { getAdminPartnerReferralsFromMock } from "../mocks/admin-partner-referrals.mock";
import type { AdminPartnerReferral } from "../models/admin-partner-referral";

export async function getAdminPartnerReferrals(partnerId: string): Promise<AdminPartnerReferral[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getAdminPartnerReferralsFromMock(partnerId);
}
