import {
  OLVA_ORDER_CODE_LENGTH,
  OLVA_ORDER_NUMBER_MAX_LENGTH,
  OLVA_ORDER_NUMBER_MIN_LENGTH,
} from "../constants/olva-tracking.constants";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";

const ORDER_NUMBER = new RegExp(
  `^\\d{${OLVA_ORDER_NUMBER_MIN_LENGTH},${OLVA_ORDER_NUMBER_MAX_LENGTH}}$`,
);
const ORDER_CODE = new RegExp(`^\\d{${OLVA_ORDER_CODE_LENGTH}}$`);

/** Same rule as the backend: 6-12 digit order number, optional 2-digit order code. */
export function isValidOlvaTrackingLookup({ orderNumber, orderCode }: OlvaTrackingLookup): boolean {
  const code = orderCode?.trim();

  return ORDER_NUMBER.test(orderNumber.trim()) && (!code || ORDER_CODE.test(code));
}
