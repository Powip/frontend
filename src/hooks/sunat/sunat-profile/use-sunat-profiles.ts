import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { sunatProfileKeys } from "@/api/sunat/keys/sunat-profile.keys";
import * as service from "@/services/sunat/sunat-profile.service";
import { SunatProfile } from "@/models/sunat/sunat-profile";

export function useSunatProfiles(): UseQueryResult<
  SunatProfile[],
  Error
> {
  return useQuery({
    queryKey: sunatProfileKeys.lists(),
    queryFn: service.getSunatProfiles,
  });
}
