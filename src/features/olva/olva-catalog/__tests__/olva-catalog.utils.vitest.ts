import { describe, expect, it } from "vitest";
import { toOlvaHeadquarter } from "../mappers/to-olva-headquarter";
import { toOlvaUbigeo } from "../mappers/to-olva-ubigeo";
import {
  buildOlvaHeadquarterResponse,
  buildOlvaUbigeoResponse,
} from "../test-utils/olva-catalog.fixtures";
import { findOlvaPaymentModality } from "../utils/find-olva-payment-modality";
import { getOlvaAvailableWhoPays } from "../utils/get-olva-available-who-pays";
import { indexOlvaUbigeosByCode } from "../utils/index-olva-ubigeos-by-code";
import { requiresOlvaPaymentMethod } from "../utils/requires-olva-payment-method";

const headquarter = toOlvaHeadquarter(buildOlvaHeadquarterResponse());

describe("olva-catalog", () => {
  it("maps ids to friendly names", () => {
    expect(headquarter.id).toBe("12");
    expect(headquarter.paymentModalities).toHaveLength(2);
  });

  it("sorts modalities by sortOrder without mutating the model", () => {
    expect(getOlvaAvailableWhoPays(headquarter).map((m) => m.code)).toEqual(["ONLINE", "STORE"]);
    expect(headquarter.paymentModalities[0].code).toBe("STORE");
  });

  it("finds a modality and knows if it needs a payment method", () => {
    expect(findOlvaPaymentModality(headquarter, "ONLINE")?.title).toBe("Pago online");
    expect(findOlvaPaymentModality(headquarter, "DESTINATION")).toBeUndefined();
    expect(requiresOlvaPaymentMethod(headquarter, "ONLINE")).toBe(true);
    expect(requiresOlvaPaymentMethod(headquarter, "STORE")).toBe(false);
    expect(requiresOlvaPaymentMethod(headquarter, "DESTINATION")).toBe(false);
  });

  it("indexes ubigeos by code", () => {
    const index = indexOlvaUbigeosByCode([
      toOlvaUbigeo(buildOlvaUbigeoResponse({ ubigeo_code: "150101", ubigeo_id: "1" })),
      toOlvaUbigeo(buildOlvaUbigeoResponse({ ubigeo_code: "150122", ubigeo_id: "2" })),
    ]);

    expect(index.get("150122")?.id).toBe("2");
    expect(index.get("999999")).toBeUndefined();
  });
});
