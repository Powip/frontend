import type { PartnerResource } from "../models/partner-resource";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPartnerResources(): Promise<PartnerResource[]> {
  return unavailablePartnersFeature("Consultar recursos para partners");
}
