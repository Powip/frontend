import { useQuery } from "@tanstack/react-query";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import { getOlvaSenderProfiles } from "../services/olva-sender-profile.service";

export function useOlvaSenderProfiles() {
  return useQuery<OlvaSenderProfile[], Error>({
    queryKey: olvaSenderProfileKeys.lists(),
    queryFn: getOlvaSenderProfiles,
  });
}
