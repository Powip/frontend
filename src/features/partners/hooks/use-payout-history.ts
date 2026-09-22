import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PayoutHistoryEntry } from "../models/payout-history-entry";
import { getPayoutHistory } from "../services/get-payout-history";

export function usePayoutHistory() {
  return useQuery<PayoutHistoryEntry[], Error>({
    queryKey: partnersKeys.payoutHistory(),
    queryFn: getPayoutHistory,
  });
}
