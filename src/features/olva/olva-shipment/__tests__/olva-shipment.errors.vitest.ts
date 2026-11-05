import { describe, expect, it } from "vitest";
import { buildOlvaAxiosError } from "../../shared/test-utils/axios-error";
import { isOlvaOrderReleased } from "../utils/is-olva-order-released";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

describe("getOlvaShipmentErrorMessage", () => {
  it.each([
    ["SHIPMENT_ALREADY_EXISTS", "Este pedido ya tiene un envío de Olva activo."],
    [
      "SHIPMENT_DESTINATION_UBIGEO_NOT_FOUND",
      "El ubigeo de destino no existe en Olva. Elige otro distrito e intenta de nuevo.",
    ],
    [
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "El medio de pago no está disponible por ahora. Elige pago con tarjeta (Niubiz) o intenta de nuevo en unos minutos.",
    ],
    [
      "SHIPMENT_ORIGIN_DOES_NOT_ACCEPT_PAYMENT",
      "La sede de origen no acepta esa forma de pago. Elige otra forma de pago.",
    ],
  ])("%s", (code, message) => {
    expect(getOlvaShipmentErrorMessage(buildOlvaAxiosError(409, { details: { code } }))).toBe(
      message,
    );
  });

  it("falls back to the generic Olva codes", () => {
    const error = buildOlvaAxiosError(502, { details: { code: "OLVA_OUTCOME_UNKNOWN" } });

    expect(getOlvaShipmentErrorMessage(error)).toContain("Revisa tu lista de envíos");
  });
});

describe("isOlvaOrderReleased", () => {
  it("only DRAFT, REJECTED and RETURNED free the order", () => {
    expect(
      (
        ["DRAFT", "REJECTED", "RETURNED", "REGISTERED", "DELIVERED", "PENDING_PAYMENT"] as const
      ).filter(isOlvaOrderReleased),
    ).toEqual(["DRAFT", "REJECTED", "RETURNED"]);
  });
});
