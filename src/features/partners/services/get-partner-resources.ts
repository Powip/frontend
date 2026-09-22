import { PARTNER_RESOURCES_MOCK } from "../mocks/partner-resources.mock";
import type { PartnerResource } from "../models/partner-resource";

export async function getPartnerResources(): Promise<PartnerResource[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PARTNER_RESOURCES_MOCK;
}
