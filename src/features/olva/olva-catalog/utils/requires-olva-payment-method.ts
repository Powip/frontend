import type { OlvaWhoPays } from "../../shared/constants/olva-enums.constants";
import type { OlvaHeadquarter } from "../models/olva-headquarter";
import { findOlvaPaymentModality } from "./find-olva-payment-modality";

/** True when paying that way also needs a payment method (e.g. ONLINE -> pagoefectivo/niubiz). */
export function requiresOlvaPaymentMethod(
  headquarter: Pick<OlvaHeadquarter, "paymentModalities">,
  whoPays: OlvaWhoPays,
): boolean {
  return findOlvaPaymentModality(headquarter, whoPays)?.requiresPaymentMethod ?? false;
}
