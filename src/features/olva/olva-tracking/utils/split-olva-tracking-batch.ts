import type {
  OlvaTrackingBatchFailed,
  OlvaTrackingBatchFound,
  OlvaTrackingBatchItem,
} from "../models/olva-tracking-batch-item";

export interface SplitOlvaTrackingBatch {
  found: OlvaTrackingBatchFound[];
  failed: OlvaTrackingBatchFailed[];
}

/** Separates the guides that were found from the ones that failed, keeping request order. */
export function splitOlvaTrackingBatch(
  items: readonly OlvaTrackingBatchItem[],
): SplitOlvaTrackingBatch {
  const found: OlvaTrackingBatchFound[] = [];
  const failed: OlvaTrackingBatchFailed[] = [];

  for (const item of items) {
    if (item.success) found.push(item);
    else failed.push(item);
  }

  return { found, failed };
}
