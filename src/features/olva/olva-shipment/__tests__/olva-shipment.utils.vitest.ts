import { afterEach, describe, expect, it, vi } from "vitest";
import { OLVA_SHIPMENT_STATUSES } from "../../shared/constants/olva-enums.constants";
import { OLVA_SHIPMENT_STATUS_LABELS } from "../constants/olva-shipment.constants";
import { canRegenerateOlvaPaymentLink } from "../utils/can-regenerate-olva-payment-link";
import { createOlvaIdempotencyKey } from "../utils/create-olva-idempotency-key";
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

  describe("createOlvaIdempotencyKey", () => {
    const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    afterEach(() => vi.unstubAllGlobals());

    it("creates distinct v4 UUIDs", () => {
      const [a, b] = [createOlvaIdempotencyKey(), createOlvaIdempotencyKey()];

      expect(a).toMatch(UUID_V4);
      expect(a).not.toBe(b);
    });

    it("still works when crypto.randomUUID is missing (insecure contexts, jsdom)", () => {
      vi.stubGlobal("crypto", {
        getRandomValues: (bytes: Uint8Array) => bytes.map((_, index) => index * 7),
      });

      expect(createOlvaIdempotencyKey()).toMatch(UUID_V4);
    });

    it("still works without any crypto at all", () => {
      vi.stubGlobal("crypto", undefined);

      const [a, b] = [createOlvaIdempotencyKey(), createOlvaIdempotencyKey()];

      expect(a).toMatch(UUID_V4);
      expect(a).not.toBe(b);
    });
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
