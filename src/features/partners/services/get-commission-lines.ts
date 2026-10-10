import type { CommissionLine } from "../models/commission-line";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getCommissionLines(): Promise<CommissionLine[]> {
  return unavailablePartnersFeature("Consultar comisiones");
}
