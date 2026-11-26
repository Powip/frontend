import {
  type OlvaShipmentStatus,
  OLVA_SHIPMENT_STATUSES as S,
} from "@/features/olva/shared/constants/olva-enums.constants";

const DANGER: readonly OlvaShipmentStatus[] = [S.FAILED, S.REJECTED, S.INCIDENT, S.RETURNED];
const WAITING: readonly OlvaShipmentStatus[] = [
  S.SUBMITTING,
  S.PENDING_PAYMENT,
  S.PAYMENT_EXPIRED,
  S.DISCARDED,
  S.DRAFT,
  S.UNKNOWN,
];

/** The badge variant of a shipment status: red when it went wrong, grey while it waits. */
export function olvaStatusBadgeVariant(status: OlvaShipmentStatus) {
  if (DANGER.includes(status)) return "destructive" as const;
  if (WAITING.includes(status)) return "secondary" as const;
  return "default" as const;
}
