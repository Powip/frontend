import type { AdminThresholdQueueItem } from "../models/admin-liquidation-row";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminThresholdQueue(): Promise<AdminThresholdQueueItem[]> {
  return unavailablePartnersFeature("Consultar la cola por umbral");
}
