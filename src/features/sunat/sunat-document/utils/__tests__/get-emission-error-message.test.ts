import {
  GENERIC_EMISSION_ERROR_MESSAGE,
  getEmissionErrorMessage,
} from "../get-emission-error-message";

const error = (code: string) => ({ orderId: "order-1", error: { code, message: "backend text" } });

describe("getEmissionErrorMessage", () => {
  it("explica que el RUC no tiene la serie configurada", () => {
    expect(getEmissionErrorMessage(error("SUNAT_DOCUMENT_SEQUENCE_NOT_INITIALIZED"))).toMatch(
      /no tiene esa serie configurada/,
    );
  });

  it("explica que el RUC está inactivo", () => {
    expect(getEmissionErrorMessage(error("SUNAT_PROFILE_INACTIVE"))).toMatch(/inactivo/);
  });

  it("explica que la venta ya tiene comprobante", () => {
    expect(getEmissionErrorMessage(error("SUNAT_ORDER_ALREADY_HAS_DOCUMENT"))).toMatch(
      /ya tiene un comprobante/,
    );
  });

  it("usa un mensaje genérico para códigos desconocidos, sin mostrar texto técnico", () => {
    expect(getEmissionErrorMessage(error("UNEXPECTED_ERROR"))).toBe(GENERIC_EMISSION_ERROR_MESSAGE);
  });
});
