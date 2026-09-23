import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { ReviewQueueItem } from "../models/review-queue-item";
import { getReviewQueue } from "../services/get-review-queue";

export function useReviewQueue() {
  return useQuery<ReviewQueueItem[], Error>({
    queryKey: partnersKeys.reviewQueue(),
    queryFn: getReviewQueue,
  });
}
