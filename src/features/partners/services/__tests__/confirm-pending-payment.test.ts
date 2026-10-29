import { confirmPendingPayment } from "../confirm-pending-payment";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("confirmPendingPayment", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(confirmPendingPayment("fixture-id")).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(confirmPendingPayment("fixture-id")).rejects.toBeInstanceOf(
      PartnersFeatureUnavailableError,
    );
    await expect(confirmPendingPayment("fixture-id")).rejects.toThrow(
      /todavía no está implementado/,
    );
  });
});
