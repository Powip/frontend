import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { CommissionOptionDetail } from "../models/commission-option-detail";
import { getCommissionOptions } from "../services/get-commission-options";

export function useCommissionOptions() {
  return useQuery<CommissionOptionDetail[], Error>({
    queryKey: partnersKeys.commissionOptions(),
    queryFn: getCommissionOptions,
  });
}
