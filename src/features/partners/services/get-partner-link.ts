import type { PartnerLink } from "../models/partner-link";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPartnerLink(): Promise<PartnerLink> {
  return unavailablePartnersFeature("Consultar descuento y métricas del link");
}
