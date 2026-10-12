import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerApprovalStatus } from "../models/admin-partner";
import { getAdminPartners } from "../services/get-admin-partners";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminPartners(status: PartnerApprovalStatus | null = null, limit = 20) {
  const session = useAdminReadSession();
  return useInfiniteQuery({
    queryKey: partnersKeys.adminPartners(session.userId, status, limit, session.epoch),
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        getAdminPartners({ accessToken, cursor: pageParam, limit, status, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
}
