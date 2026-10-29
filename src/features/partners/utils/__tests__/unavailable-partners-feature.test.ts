import {
  isPartnersFeatureUnavailable,
  partnersMutationErrorMessage,
  PartnersFeatureUnavailableError,
  unavailablePartnersFeature,
} from "../unavailable-partners-feature";

describe("Partners permanent feature unavailability", () => {
  it("throws an identifiable permanent error with an explicit implementation message", () => {
    expect(() => unavailablePartnersFeature("Consultar pagos")).toThrow(
      PartnersFeatureUnavailableError,
    );
    const error = new PartnersFeatureUnavailableError("Consultar pagos");
    expect(error.code).toBe("PERMANENT_FEATURE_UNAVAILABLE");
    expect(isPartnersFeatureUnavailable(error)).toBe(true);
    expect(error.message).toMatch(/todavía no está implementado/);
    expect(partnersMutationErrorMessage(error, "Reintentar")).toBe(error.message);
  });

  it("does not classify an ordinary network error as a missing implementation", () => {
    expect(isPartnersFeatureUnavailable(new Error("Network error"))).toBe(false);
    expect(isPartnersFeatureUnavailable(null)).toBe(false);
    expect(partnersMutationErrorMessage(new Error("Network error"), "Reintentar")).toBe(
      "Reintentar",
    );
  });
});
