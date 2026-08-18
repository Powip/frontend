import { useQuery } from "@tanstack/react-query";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { getSunatProfiles } from "../services/sunat-profile.service";

export function useSunatProfiles() {
  return useQuery<SunatProfile[], Error>({
    queryKey: sunatProfileKeys.lists(),
    queryFn: getSunatProfiles,
  });
}
