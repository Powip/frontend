import type { PartnerSummary } from "../models/partner-summary";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPartnerSummary(): Promise<PartnerSummary> {
  return unavailablePartnersFeature("Consultar métricas y saldo del partner");
}
