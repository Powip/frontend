import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getAdminPartner } from "../services/get-admin-partner";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminPartner(id: string) {
  const session = useAdminReadSession(Boolean(id));
  return useQuery({
    queryKey: partnersKeys.adminPartner(id, session.userId, session.epoch),
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) =>
        getAdminPartner({ accessToken, partnerId: id, signal }),
      ),
    enabled: session.enabled,
    retry: false,
  });
}
