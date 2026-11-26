import type { OlvaHeadquarter, OlvaPaymentModality } from "../models/olva-headquarter";

/** Payment modalities a branch offers, in the order Olva wants them shown (`sortOrder`). */
export function getOlvaAvailableWhoPays(
  headquarter: Pick<OlvaHeadquarter, "paymentModalities">,
): OlvaPaymentModality[] {
  return [...headquarter.paymentModalities].sort((a, b) => a.sortOrder - b.sortOrder);
}
