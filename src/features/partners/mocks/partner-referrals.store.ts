import { PARTNER_REFERRALS_MOCK } from "./partner-referrals.mock";
import type { PartnerReferral } from "../models/partner-referral";

let referrals: PartnerReferral[] = [...PARTNER_REFERRALS_MOCK];

export function listPartnerReferrals(): PartnerReferral[] {
  return referrals;
}

export function addPartnerReferral(referral: PartnerReferral): void {
  referrals = [referral, ...referrals];
}

export function resetPartnerReferralsStore(): void {
  referrals = [...PARTNER_REFERRALS_MOCK];
}
