import type { PayoutSettings } from "../models/payout-settings";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPayoutSettings(): Promise<PayoutSettings> {
  return unavailablePartnersFeature("Consultar datos de cobro");
}
