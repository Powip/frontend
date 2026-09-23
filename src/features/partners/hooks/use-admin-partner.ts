import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminPartner } from "../models/admin-partner";
import { getAdminPartner } from "../services/get-admin-partner";

export function useAdminPartner(id: string) {
  return useQuery<AdminPartner | null, Error>({
    queryKey: partnersKeys.adminPartner(id),
    queryFn: () => getAdminPartner(id),
  });
}
