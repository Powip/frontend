import { listPartnerReferrals } from "../mocks/partner-referrals.store";
import type { PartnerReferral } from "../models/partner-referral";

export async function getReferrals(): Promise<PartnerReferral[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return listPartnerReferrals();
}
