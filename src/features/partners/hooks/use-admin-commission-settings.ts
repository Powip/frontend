import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminCommissionSettings } from "../models/admin-commission-settings";
import { getAdminCommissionSettings } from "../services/get-admin-commission-settings";

export function useAdminCommissionSettings() {
  return useQuery<AdminCommissionSettings, Error>({
    queryKey: partnersKeys.adminCommissionSettings(),
    queryFn: getAdminCommissionSettings,
  });
}
