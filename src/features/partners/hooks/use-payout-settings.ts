import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PayoutSettings } from "../models/payout-settings";
import { getPayoutSettings } from "../services/get-payout-settings";

export function usePayoutSettings() {
  return useQuery<PayoutSettings, Error>({
    queryKey: partnersKeys.payoutSettings(),
    queryFn: getPayoutSettings,
  });
}
