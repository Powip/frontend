import type { OlvaWhoPays } from "../../shared/constants/olva-enums.constants";
import type { OlvaHeadquarter, OlvaPaymentModality } from "../models/olva-headquarter";

export function findOlvaPaymentModality(
  headquarter: Pick<OlvaHeadquarter, "paymentModalities">,
  whoPays: OlvaWhoPays,
): OlvaPaymentModality | undefined {
  return headquarter.paymentModalities.find((modality) => modality.code === whoPays);
}
