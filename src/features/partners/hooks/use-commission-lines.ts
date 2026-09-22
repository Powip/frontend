import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { CommissionLine } from "../models/commission-line";
import { getCommissionLines } from "../services/get-commission-lines";

export function useCommissionLines() {
  return useQuery<CommissionLine[], Error>({
    queryKey: partnersKeys.commissions(),
    queryFn: getCommissionLines,
  });
}
