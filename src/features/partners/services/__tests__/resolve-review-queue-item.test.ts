import { resolveReviewQueueItem } from "../resolve-review-queue-item";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";

describe("resolveReviewQueueItem", () => {
  it("rechaza la operación pendiente sin devolver datos ni éxitos simulados", async () => {
    await expect(resolveReviewQueueItem("fixture-item", "aprobado")).rejects.toMatchObject({
      code: "PERMANENT_FEATURE_UNAVAILABLE",
      name: "PartnersFeatureUnavailableError",
    });
  });

  it("informa explícitamente que la operación todavía no está implementada", async () => {
    await expect(resolveReviewQueueItem("fixture-item", "aprobado")).rejects.toBeInstanceOf(
      PartnersFeatureUnavailableError,
    );
    await expect(resolveReviewQueueItem("fixture-item", "aprobado")).rejects.toThrow(
      /todavía no está implementado/,
    );
  });
});
