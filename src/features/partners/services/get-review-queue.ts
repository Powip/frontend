import { listReviewQueue } from "../mocks/review-queue.store";
import type { ReviewQueueItem } from "../models/review-queue-item";

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return listReviewQueue();
}
