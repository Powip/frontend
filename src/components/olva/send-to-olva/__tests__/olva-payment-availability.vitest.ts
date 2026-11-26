import { describe, expect, it } from "vitest";
import type { OlvaPaymentModality } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { buildOlvaHeadquarterResponse } from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import {
  filterAvailableOlvaModalities,
  getDefaultOlvaHomePaymentMethod,
  getOlvaOnlinePaymentMethods,
  isOlvaHomeDeliveryAvailable,
  isOlvaPaymentMethodAvailable,
} from "../utils/olva-payment-methods";

// FEAT-35: PagoEfectivo works at Olva; Niubiz (card) still cannot be completed. The headquarter
// lists both, like Olva's catalog does
const modalities = buildOlvaHeadquarterResponse().paymentModalities as OlvaPaymentModality[];
const headquarter = { paymentModalities: modalities };

describe("online payment with PagoEfectivo", () => {
  it("offers ONLINE as a way to pay, next to paying at the store", () => {
    expect(filterAvailableOlvaModalities(modalities).map((item) => item.code)).toEqual([
      "STORE",
      "ONLINE",
    ]);
  });

  it("offers PagoEfectivo and not Niubiz", () => {
    expect(isOlvaPaymentMethodAvailable("pagoefectivo")).toBe(true);
    expect(isOlvaPaymentMethodAvailable("niubiz")).toBe(false);
    expect(getOlvaOnlinePaymentMethods(headquarter).map((method) => method.code)).toEqual([
      "pagoefectivo",
    ]);
  });

  it("starts a home delivery with PagoEfectivo already chosen, since it is the only method", () => {
    expect(getDefaultOlvaHomePaymentMethod(headquarter)).toBe("pagoefectivo");
  });

  it("offers home delivery, which is paid online", () => {
    expect(isOlvaHomeDeliveryAvailable()).toBe(true);
  });

  it("has nothing to offer online when the headquarter only lists Niubiz", () => {
    const cardOnly = modalities.map((modality) => ({
      ...modality,
      paymentMethods: modality.paymentMethods.filter((method) => method.code === "niubiz"),
    }));

    expect(getOlvaOnlinePaymentMethods({ paymentModalities: cardOnly })).toEqual([]);
    expect(getDefaultOlvaHomePaymentMethod({ paymentModalities: cardOnly })).toBeUndefined();
  });
});
