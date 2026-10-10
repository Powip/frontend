"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { PartnerProfile } from "../models/partner-profile";

const CurrentPartnerContext = createContext<PartnerProfile | null>(null);

interface CurrentPartnerProviderProps {
  profile: PartnerProfile;
  children: ReactNode;
}

export function CurrentPartnerProvider({ profile, children }: CurrentPartnerProviderProps) {
  return (
    <CurrentPartnerContext.Provider value={profile}>{children}</CurrentPartnerContext.Provider>
  );
}

export function useCurrentPartner(): PartnerProfile {
  const profile = useContext(CurrentPartnerContext);
  if (!profile) {
    throw new Error("useCurrentPartner must be used within a CurrentPartnerProvider");
  }
  return profile;
}
