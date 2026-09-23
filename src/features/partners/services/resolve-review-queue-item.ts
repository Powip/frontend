import { resolveReviewQueueItemInStore } from "../mocks/review-queue.store";
import type { QueueItemResolution, ReviewQueueItem } from "../models/review-queue-item";

export async function resolveReviewQueueItem(
  id: string,
  resolution: QueueItemResolution,
): Promise<ReviewQueueItem> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const updated = resolveReviewQueueItemInStore(id, resolution);
  if (!updated) {
    throw new Error("Referido no encontrado en la cola");
  }

  return updated;
}
