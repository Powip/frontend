import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getAdminPartnerActivity } from "../services/get-admin-partner-activity";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminPartnerActivity(partnerId: string, enabled = true, limit = 20) {
  const session = useAdminReadSession(enabled && Boolean(partnerId));
  return useInfiniteQuery({
    queryKey: partnersKeys.adminPartnerActivity(partnerId, session.userId, limit, session.epoch),
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        getAdminPartnerActivity({ accessToken, partnerId, cursor: pageParam, limit, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
}
