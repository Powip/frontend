import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerSummary } from "../models/partner-summary";
import { getPartnerSummary } from "../services/get-partner-summary";

export function usePartnerSummary() {
  return useQuery<PartnerSummary, Error>({
    queryKey: partnersKeys.summary(),
    queryFn: getPartnerSummary,
  });
}
