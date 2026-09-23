import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminPartnerReferral } from "../models/admin-partner-referral";
import { getAdminPartnerReferrals } from "../services/get-admin-partner-referrals";

export function useAdminPartnerReferrals(partnerId: string) {
  return useQuery<AdminPartnerReferral[], Error>({
    queryKey: partnersKeys.adminPartnerReferrals(partnerId),
    queryFn: () => getAdminPartnerReferrals(partnerId),
  });
}
