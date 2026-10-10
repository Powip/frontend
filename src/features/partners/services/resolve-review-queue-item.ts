import type { QueueItemResolution, ReviewQueueItem } from "../models/review-queue-item";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function resolveReviewQueueItem(
  id: string,
  resolution: QueueItemResolution,
): Promise<ReviewQueueItem> {
  void id;
  void resolution;
  return unavailablePartnersFeature("Resolver un referido de la cola");
}
