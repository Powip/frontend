import { REVIEW_QUEUE_MOCK } from "./review-queue.mock";
import type { QueueItemResolution, ReviewQueueItem } from "../models/review-queue-item";

let queue: ReviewQueueItem[] = [...REVIEW_QUEUE_MOCK];

export function listReviewQueue(): ReviewQueueItem[] {
  return queue;
}

export function resolveReviewQueueItemInStore(
  id: string,
  resolution: QueueItemResolution,
): ReviewQueueItem | undefined {
  let updated: ReviewQueueItem | undefined;
  queue = queue.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, resolution };
    return updated;
  });
  return updated;
}

export function resetReviewQueueStore(): void {
  queue = [...REVIEW_QUEUE_MOCK];
}
