import { getPartnerReferralsApi } from "../api/partner-referrals.api";
import { toPartnerReferralPage } from "../mappers/to-partner-referral";
import type { PartnerReferralPage } from "../models/partner-referral-page";

export async function getReferrals(cursor: string | null = null): Promise<PartnerReferralPage> {
  const responseDto = await getPartnerReferralsApi(cursor);

  return toPartnerReferralPage(responseDto);
}
