import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminClawback } from "../models/admin-liquidation-row";
import { getAdminClawbacks } from "../services/get-admin-clawbacks";

export function useAdminClawbacks() {
  return useQuery<AdminClawback[], Error>({
    queryKey: partnersKeys.adminClawbacks(),
    queryFn: getAdminClawbacks,
  });
}
