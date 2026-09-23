import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { UnopenedInvitation } from "../models/unopened-invitation";
import { getUnopenedInvitations } from "../services/get-unopened-invitations";

export function useUnopenedInvitations() {
  return useQuery<UnopenedInvitation[], Error>({
    queryKey: partnersKeys.unopenedInvitations(),
    queryFn: getUnopenedInvitations,
  });
}
