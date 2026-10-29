import { getPartnerAttributionsApi } from "../api/partner-attributions.api";
import { toPartnerAttributionPage } from "../mappers/to-partner-attribution";
import type { PartnerAttributionPage } from "../models/partner-attribution";

export async function getPartnerAttributions(
  cursor: string | null,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PartnerAttributionPage> {
  return toPartnerAttributionPage(await getPartnerAttributionsApi(cursor, accessToken, signal));
}
