import type { PayoutHistoryEntry } from "../models/payout-history-entry";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getPayoutHistory(): Promise<PayoutHistoryEntry[]> {
  return unavailablePartnersFeature("Consultar historial de pagos");
}
