import type { AdminPartnerReferral } from "../models/admin-partner-referral";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminPartnerReferrals(partnerId: string): Promise<AdminPartnerReferral[]> {
  void partnerId;
  return unavailablePartnersFeature("Consultar referidos de otro partner");
}
