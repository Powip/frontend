import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { isValidOlvaTrackingLookup } from "./is-valid-olva-tracking-lookup";

const GUIDE = /^(\d+)-(\d+)$/;

/**
 * Olva writes a guide as "<number>-<year>" (e.g. "1234567-26"); its tracking wants the two parts
 * apart. Anything else (blank, a manual code) is not a guide Olva can look up: `null`.
 */
export function toOlvaTrackingLookup(
  trackingNumber: string | null | undefined,
): OlvaTrackingLookup | null {
  const match = GUIDE.exec(trackingNumber?.trim() ?? "");
  if (!match) return null;

  const lookup = { orderNumber: match[1], orderCode: match[2] };
  return isValidOlvaTrackingLookup(lookup) ? lookup : null;
}
