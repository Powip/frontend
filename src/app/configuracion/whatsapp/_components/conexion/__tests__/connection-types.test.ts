import { SIGNUP_UNAVAILABLE_REASON, signupUnavailableReason } from "../connection-types";

describe("signupUnavailableReason", () => {
  it("names only the variable the server says is missing", () => {
    expect(signupUnavailableReason(["WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID"])).toBe(
      "Falta configurar en el servidor: WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID. No se abrió ninguna ventana de Meta.",
    );
  });

  it("falls back to the generic text when the server does not say", () => {
    expect(signupUnavailableReason(undefined)).toBe(SIGNUP_UNAVAILABLE_REASON);
    expect(signupUnavailableReason([])).toBe(SIGNUP_UNAVAILABLE_REASON);
  });
});
