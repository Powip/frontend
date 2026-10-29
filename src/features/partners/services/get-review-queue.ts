import type { ReviewQueueItem } from "../models/review-queue-item";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  return unavailablePartnersFeature("Consultar la cola de revisión");
}
