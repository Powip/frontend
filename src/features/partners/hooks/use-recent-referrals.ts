import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerReferral } from "../models/partner-referral";
import { getRecentReferrals } from "../services/get-recent-referrals";

export function useRecentReferrals(limit: number) {
  const { auth } = useAuth();
  const userId = auth?.user.id;

  return useQuery<PartnerReferral[], Error>({
    queryKey: partnersKeys.referrals(limit, userId),
    queryFn: () => getRecentReferrals(limit),
    enabled: Boolean(userId && auth?.accessToken),
  });
}
