import { ADMIN_THRESHOLD_QUEUE_MOCK } from "../mocks/admin-liquidations.mock";
import type { AdminThresholdQueueItem } from "../models/admin-liquidation-row";

export async function getAdminThresholdQueue(): Promise<AdminThresholdQueueItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return ADMIN_THRESHOLD_QUEUE_MOCK;
}
