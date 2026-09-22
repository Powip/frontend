import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerReferral } from "../models/partner-referral";
import { getReferrals } from "../services/get-referrals";

export function useReferrals() {
  return useQuery<PartnerReferral[], Error>({
    queryKey: partnersKeys.referrals(),
    queryFn: getReferrals,
  });
}
