import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerLink } from "../models/partner-link";
import { getPartnerLink } from "../services/get-partner-link";

export function usePartnerLink() {
  return useQuery<PartnerLink, Error>({
    queryKey: partnersKeys.link(),
    queryFn: getPartnerLink,
  });
}
