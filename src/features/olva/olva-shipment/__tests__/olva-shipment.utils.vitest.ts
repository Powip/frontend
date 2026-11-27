import { describe, expect, it } from "vitest";
import { OLVA_SHIPMENT_STATUSES } from "../../shared/constants/olva-enums.constants";
import { OLVA_SHIPMENT_STATUS_LABELS } from "../constants/olva-shipment.constants";
import { canRegenerateOlvaPaymentLink } from "../utils/can-regenerate-olva-payment-link";
import { getOlvaShipmentStatusLabel } from "../utils/get-olva-shipment-status-label";
import { isOlvaShipmentFinal } from "../utils/is-olva-shipment-final";
import { normalizeOlvaShipmentFilters } from "../utils/normalize-olva-shipment-filters";
import { olvaShipmentLabelToBlob } from "../utils/olva-shipment-label-to-blob";

describe("olva-shipment utils", () => {
  it("only PENDING_PAYMENT and PAYMENT_EXPIRED allow a new payment link", () => {
    const allowed = Object.values(OLVA_SHIPMENT_STATUSES).filter(canRegenerateOlvaPaymentLink);

    expect(allowed).toEqual(["PENDING_PAYMENT", "PAYMENT_EXPIRED"]);
  });

  it("knows the final statuses", () => {
    expect(isOlvaShipmentFinal("DELIVERED")).toBe(true);
    expect(isOlvaShipmentFinal("IN_TRANSIT")).toBe(false);
  });

  it("has a label for every status", () => {
    for (const status of Object.values(OLVA_SHIPMENT_STATUSES)) {
      expect(getOlvaShipmentStatusLabel(status)).toBe(OLVA_SHIPMENT_STATUS_LABELS[status]);
    }
  });

  it("normalizes filters", () => {
    expect(normalizeOlvaShipmentFilters({ q: " ", page: 2, status: undefined })).toEqual({
      page: 2,
    });
  });

  it("decodes the base64 label into a typed Blob", async () => {
    const blob = olvaShipmentLabelToBlob({
      filename: "g.pdf",
      mimeType: "application/pdf",
      pdfBase64: btoa("%PDF-1.4"),
    });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(8);
  });
});
