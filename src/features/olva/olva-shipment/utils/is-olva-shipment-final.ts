import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import { OLVA_FINAL_SHIPMENT_STATUSES } from "../constants/olva-shipment.constants";

export function isOlvaShipmentFinal(status: OlvaShipmentStatus): boolean {
  return OLVA_FINAL_SHIPMENT_STATUSES.includes(status);
}
