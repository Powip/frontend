import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerResource } from "../models/partner-resource";
import { getPartnerResources } from "../services/get-partner-resources";

export function usePartnerResources() {
  return useQuery<PartnerResource[], Error>({
    queryKey: [...partnersKeys.resources(), "permanent-unavailable-v1"],
    queryFn: getPartnerResources,
    retry: false,
  });
}
