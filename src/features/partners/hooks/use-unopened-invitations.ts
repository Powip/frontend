import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getUnopenedInvitations } from "../services/get-unopened-invitations";
import { useAdminReadSession } from "./use-admin-read-session";
import type { InvitationStateFilter } from "../schemas/admin-invitations.schema";

export function useUnopenedInvitations(limit = 20, state: InvitationStateFilter = "ALL") {
  const session = useAdminReadSession();
  return useInfiniteQuery({
    queryKey: partnersKeys.adminInvitations(session.userId, session.epoch, limit, state),
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        getUnopenedInvitations({ accessToken, cursor: pageParam, limit, signal, state }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
}
