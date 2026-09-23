import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminThresholdQueueItem } from "../models/admin-liquidation-row";
import { getAdminThresholdQueue } from "../services/get-admin-threshold-queue";

export function useAdminThresholdQueue() {
  return useQuery<AdminThresholdQueueItem[], Error>({
    queryKey: partnersKeys.adminThresholdQueue(),
    queryFn: getAdminThresholdQueue,
  });
}
