import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminLiquidationRow } from "../models/admin-liquidation-row";
import { getAdminLiquidations } from "../services/get-admin-liquidations";

export function useAdminLiquidations() {
  return useQuery<AdminLiquidationRow[], Error>({
    queryKey: partnersKeys.adminLiquidations(),
    queryFn: getAdminLiquidations,
  });
}
