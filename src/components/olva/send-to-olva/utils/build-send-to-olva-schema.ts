import type { OlvaStandardSize } from "@/features/olva/olva-catalog/models/olva-standard-size";
import { getOlvaSizeWeightError } from "@/features/olva/olva-catalog/utils/get-olva-size-weight-error";
import { bulkCreateOlvaShipmentsSchema } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";

/**
 * The lot schema plus the one rule that needs the size catalog: the weight must fit the size
 * (Olva answers 422 otherwise). Without the catalog loaded there is nothing to check against.
 */
export function buildSendToOlvaSchema(sizes: readonly OlvaStandardSize[]) {
  return bulkCreateOlvaShipmentsSchema.superRefine((lot, ctx) => {
    lot.items.forEach((item, index) => {
      const message = getOlvaSizeWeightError(sizes, {
        sizeId: item.package.sizeId,
        weightKg: item.package.weightKg,
      });

      if (message) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "package", "weightKg"],
          message,
        });
      }
    });
  });
}
