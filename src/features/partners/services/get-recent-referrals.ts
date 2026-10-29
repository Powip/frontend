import { getPartnerReferralsApi } from "../api/partner-referrals.api";
import { toPartnerReferralPage } from "../mappers/to-partner-referral";
import type { PartnerReferral } from "../models/partner-referral";

export async function getRecentReferrals(limit: number): Promise<PartnerReferral[]> {
  const responseDto = await getPartnerReferralsApi(null, limit);

  return toPartnerReferralPage(responseDto).items.slice(0, limit);
}
