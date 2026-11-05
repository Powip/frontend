import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import { OLVA_PAYMENT_LINK_REGENERABLE_STATUSES } from "../constants/olva-shipment.constants";

/** Whether to offer "regenerate payment link" (the backend answers 409 for any other status). */
export function canRegenerateOlvaPaymentLink(status: OlvaShipmentStatus): boolean {
  return OLVA_PAYMENT_LINK_REGENERABLE_STATUSES.includes(status);
}
