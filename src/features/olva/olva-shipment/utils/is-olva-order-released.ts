import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import { OLVA_STATUSES_THAT_RELEASE_ORDER } from "../constants/olva-shipment.constants";

/**
 * True when a shipment with this status no longer holds its order, so the order can be shipped
 * again. Any other status means the order is taken (the backend answers SHIPMENT_ALREADY_EXISTS).
 */
export function isOlvaOrderReleased(status: OlvaShipmentStatus): boolean {
  return OLVA_STATUSES_THAT_RELEASE_ORDER.includes(status);
}
