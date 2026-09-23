import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminPartner } from "../models/admin-partner";
import { getAdminPartners } from "../services/get-admin-partners";

export function useAdminPartners() {
  return useQuery<AdminPartner[], Error>({
    queryKey: partnersKeys.adminPartners(),
    queryFn: getAdminPartners,
  });
}
