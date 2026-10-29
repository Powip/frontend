import { getPartnerMeApi } from "../api/partner-me.api";
import { toPartnerIdentityFromError } from "../mappers/to-partner-identity-from-error";
import { toPartnerProfile } from "../mappers/to-partner-profile";
import type { PartnerIdentity } from "../models/partner-identity";

export async function getPartnerIdentity(): Promise<PartnerIdentity> {
  try {
    const responseDto = await getPartnerMeApi();

    return { kind: "partner", profile: toPartnerProfile(responseDto) };
  } catch (error) {
    const identity = toPartnerIdentityFromError(error);

    if (identity) {
      return identity;
    }

    throw error;
  }
}
