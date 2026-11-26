import { useQuery } from "@tanstack/react-query";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import { getOlvaSenderProfile } from "../services/olva-sender-profile.service";

export function useOlvaSenderProfile(id: string | undefined) {
  return useQuery<OlvaSenderProfile, Error>({
    queryKey: olvaSenderProfileKeys.detail(id ?? ""),
    queryFn: () => getOlvaSenderProfile(id as string),
    enabled: Boolean(id),
  });
}
