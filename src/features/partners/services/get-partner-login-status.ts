import { getPartnerMeWithTokenApi } from "../api/partner-me.api";
import { toPartnerIdentityFromError } from "../mappers/to-partner-identity-from-error";

export type PartnerLoginStatus = "partner" | "not_partner" | "unknown";

export async function getPartnerLoginStatus(accessToken: string): Promise<PartnerLoginStatus> {
  try {
    await getPartnerMeWithTokenApi(accessToken);
    return "partner";
  } catch (error) {
    const identity = toPartnerIdentityFromError(error);
    if (!identity) return "unknown";
    return identity.kind === "not_partner" ? "not_partner" : "partner";
  }
}
