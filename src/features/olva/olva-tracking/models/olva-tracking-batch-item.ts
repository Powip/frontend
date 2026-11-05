import type { OlvaTracking } from "./olva-tracking";

interface OlvaTrackingBatchItemIdentity {
  orderNumber: string;
  orderCode: string | null;
}

export interface OlvaTrackingBatchFound extends OlvaTrackingBatchItemIdentity {
  success: true;
  tracking: OlvaTracking;
}

export interface OlvaTrackingBatchFailed extends OlvaTrackingBatchItemIdentity {
  success: false;
  error: string;
}

/** Narrow it with `item.success`. */
export type OlvaTrackingBatchItem = OlvaTrackingBatchFound | OlvaTrackingBatchFailed;
