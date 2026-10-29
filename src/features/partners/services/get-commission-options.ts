import type { CommissionOptionDetail } from "../models/commission-option-detail";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getCommissionOptions(): Promise<CommissionOptionDetail[]> {
  return unavailablePartnersFeature("Consultar opciones de comisión");
}
