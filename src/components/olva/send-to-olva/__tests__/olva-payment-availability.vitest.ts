import { describe, expect, it } from "vitest";
import type { OlvaPaymentModality } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { buildOlvaHeadquarterResponse } from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import {
  filterAvailableOlvaModalities,
  getDefaultOlvaHomePaymentMethod,
  getOlvaOnlinePaymentMethods,
  isOlvaHomeDeliveryAvailable,
} from "../utils/olva-payment-methods";

// Runs with the default setting: online payment is not available yet
const modalities = buildOlvaHeadquarterResponse().paymentModalities as OlvaPaymentModality[];

describe("while online payment is not available", () => {
  it("does not offer ONLINE as a way to pay", () => {
    expect(filterAvailableOlvaModalities(modalities).map((item) => item.code)).toEqual(["STORE"]);
  });

  it("does not offer home delivery, which can only be paid online", () => {
    expect(isOlvaHomeDeliveryAvailable()).toBe(false);
  });

  it("has no online payment methods, even if the headquarter lists some", () => {
    const headquarter = { paymentModalities: modalities };

    expect(getOlvaOnlinePaymentMethods(headquarter)).toEqual([]);
    expect(getDefaultOlvaHomePaymentMethod(headquarter)).toBeUndefined();
  });
});
