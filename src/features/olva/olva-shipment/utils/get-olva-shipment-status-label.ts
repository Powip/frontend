import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import { OLVA_SHIPMENT_STATUS_LABELS } from "../constants/olva-shipment.constants";

export function getOlvaShipmentStatusLabel(status: OlvaShipmentStatus): string {
  return OLVA_SHIPMENT_STATUS_LABELS[status] ?? OLVA_SHIPMENT_STATUS_LABELS.UNKNOWN;
}
