import { useInfiniteQuery } from "@tanstack/react-query";
import { requestAdminReviewQueue } from "../api/admin-partners.api";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminReviewQueueOrigin } from "../models/admin-review-queue";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminReviewQueue(origin: AdminReviewQueueOrigin | null = null, limit = 20) {
  const session = useAdminReadSession();
  return useInfiniteQuery({
    queryKey: partnersKeys.adminReviewQueue(session.userId, origin, limit, session.epoch),
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        requestAdminReviewQueue({ accessToken, cursor: pageParam, limit, origin, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
}
