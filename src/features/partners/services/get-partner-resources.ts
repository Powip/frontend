import { getPartnerResourcesApi } from "../api/partner-resources.api";
import type { PartnerResource } from "../models/partner-resource";

export async function getPartnerResources(
  accessToken: string,
  signal?: AbortSignal,
): Promise<PartnerResource[]> {
  const page = await getPartnerResourcesApi(accessToken, signal);
  return page.items;
}
