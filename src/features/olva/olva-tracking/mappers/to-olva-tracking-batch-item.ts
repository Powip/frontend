import type { OlvaTrackingBatchItemDto } from "../dto/track-olva-shipments-batch-response.dto";
import type { OlvaTrackingBatchItem } from "../models/olva-tracking-batch-item";
import { toOlvaTracking } from "./to-olva-tracking";

export function toOlvaTrackingBatchItem(dto: OlvaTrackingBatchItemDto): OlvaTrackingBatchItem {
  if (!dto.success) {
    return {
      success: false,
      orderNumber: dto.orderNumber,
      orderCode: dto.orderCode,
      error: dto.error,
    };
  }

  const { success, orderNumber, orderCode, ...tracking } = dto;

  return { success, orderNumber, orderCode, tracking: toOlvaTracking(tracking) };
}
