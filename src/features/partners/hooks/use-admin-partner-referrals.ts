import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getAdminPartnerReferrals } from "../services/get-admin-partner-referrals";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminPartnerReferrals(partnerId: string, enabled = true, limit = 20) {
  const session = useAdminReadSession(enabled && Boolean(partnerId));
  return useInfiniteQuery({
    queryKey: partnersKeys.adminPartnerReferrals(partnerId, session.userId, limit, session.epoch),
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        getAdminPartnerReferrals({ accessToken, partnerId, cursor: pageParam, limit, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
}
