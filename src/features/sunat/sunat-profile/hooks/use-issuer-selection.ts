import { useEffect, useMemo, useState } from "react";
import type { SunatProfile } from "../models/sunat-profile";
import {
  getActiveIssuers,
  getDefaultIssuer,
  getIssuerBlockReason,
  type IssuerBlockReason,
} from "../utils/issuers";
import { useSunatProfiles } from "./use-sunat-profiles";

export interface IssuerSelection {
  profiles: SunatProfile[];
  /** Active profiles the user can pick from (default first). */
  issuers: SunatProfile[];
  selected: SunatProfile | undefined;
  selectIssuer: (profileId: string) => void;
  /** Why the selected RUC can't emit right now, if it can't. */
  blockReason: IssuerBlockReason | null;
  isMultiRuc: boolean;
  isLoading: boolean;
}

/**
 * RUC chosen to emit with. Starts on `preferredProfileId` (the RUC picked
 * in the facturación bar) and falls back to the default profile; resets
 * every time the modal opens.
 */
export function useIssuerSelection(
  preferredProfileId: string | undefined,
  isOpen: boolean,
): IssuerSelection {
  const { data: profiles = [], isLoading } = useSunatProfiles();
  const issuers = useMemo(() => getActiveIssuers(profiles), [profiles]);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const preferred = issuers.find((issuer) => issuer.id === preferredProfileId);
    setSelectedId((preferred ?? getDefaultIssuer(profiles))?.id);
  }, [isOpen, preferredProfileId, issuers, profiles]);

  const selected = issuers.find((issuer) => issuer.id === selectedId);

  return {
    profiles,
    issuers,
    selected,
    selectIssuer: setSelectedId,
    blockReason: selected ? getIssuerBlockReason(selected) : null,
    isMultiRuc: issuers.length > 1,
    isLoading,
  };
}
