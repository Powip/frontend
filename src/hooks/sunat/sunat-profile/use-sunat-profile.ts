import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { sunatProfileKeys } from "@/api/sunat/keys/sunat-profile.keys";
import * as service from "@/services/sunat/sunat-profile.service";
import { SunatProfile } from "@/models/sunat/sunat-profile";

export function useSunatProfile(id: string): UseQueryResult<
  SunatProfile,
  Error
> {
  return useQuery({
    queryKey: sunatProfileKeys.detail(id),
    queryFn: () => service.getSunatProfile(id),
    enabled: Boolean(id),
  });
}
