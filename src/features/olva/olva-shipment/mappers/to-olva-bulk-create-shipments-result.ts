import type { BulkCreateOlvaShipmentsResponseDto } from "../dto/bulk-create-olva-shipments-response.dto";
import type { OlvaBulkCreateShipmentsResult } from "../models/olva-bulk-shipment-result";
import { toOlvaBulkShipmentResult } from "./to-olva-bulk-shipment-result";

export function toOlvaBulkCreateShipmentsResult(
  dto: BulkCreateOlvaShipmentsResponseDto,
): OlvaBulkCreateShipmentsResult {
  return { summary: { ...dto.summary }, results: dto.results.map(toOlvaBulkShipmentResult) };
}
