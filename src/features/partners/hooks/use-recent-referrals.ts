import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerReferral } from "../models/partner-referral";
import { getRecentReferrals } from "../services/get-recent-referrals";

export function useRecentReferrals(limit: number) {
  return useQuery<PartnerReferral[], Error>({
    queryKey: partnersKeys.referrals(limit),
    queryFn: () => getRecentReferrals(limit),
  });
}
