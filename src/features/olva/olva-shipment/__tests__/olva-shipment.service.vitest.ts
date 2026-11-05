import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCreateOlvaShipmentInput,
  buildCreateOlvaShipmentResponse,
  buildOlvaShipmentListItemResponse,
  buildOlvaShipmentResponse,
} from "../test-utils/olva-shipment.fixtures";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/axiosAuth", () => ({ default: http }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import {
  createOlvaShipment,
  getOlvaShipment,
  getOlvaShipmentLabel,
  getOlvaShipments,
  regenerateOlvaShipmentPaymentLink,
} from "../services/olva-shipment.service";

const ID = "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b";

describe("olva-shipment service", () => {
  beforeEach(() => {
    http.get.mockReset();
    http.post.mockReset();
  });

  it("creates with the Idempotency-Key header and the compacted body", async () => {
    http.post.mockResolvedValue({ data: buildCreateOlvaShipmentResponse() });

    const shipment = await createOlvaShipment({
      input: buildCreateOlvaShipmentInput(),
      idempotencyKey: "key-1",
    });

    const [url, body, config] = http.post.mock.calls[0];
    expect(url).toBe("http://api.test/olva/shipments");
    expect(body.origin).toEqual({ headquarterId: "12" });
    expect(config).toEqual({ headers: { "Idempotency-Key": "key-1" } });
    expect(shipment.label?.pdfBase64).toBe("JVBERg==");
  });

  it("lists with normalized params", async () => {
    http.get.mockResolvedValue({
      data: {
        data: [buildOlvaShipmentListItemResponse()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const page = await getOlvaShipments({ page: 1, q: " " });

    expect(http.get).toHaveBeenCalledWith("http://api.test/olva/shipments", {
      params: { page: 1 },
    });
    expect(page.total).toBe(1);
  });

  it("reads one, regenerates the link and asks for the label by id", async () => {
    http.get.mockResolvedValueOnce({ data: buildOlvaShipmentResponse() });
    http.post.mockResolvedValueOnce({
      data: buildOlvaShipmentResponse({ status: "PENDING_PAYMENT" }),
    });
    http.get.mockResolvedValueOnce({
      data: { filename: "g.pdf", mimeType: "application/pdf", pdfBase64: "AA==" },
    });

    expect((await getOlvaShipment(ID)).securityPin).toBe("1234");
    expect((await regenerateOlvaShipmentPaymentLink(ID)).status).toBe("PENDING_PAYMENT");
    expect((await getOlvaShipmentLabel(ID)).filename).toBe("g.pdf");

    expect(http.get.mock.calls[0][0]).toBe(`http://api.test/olva/shipments/${ID}`);
    expect(http.post.mock.calls[0][0]).toBe(`http://api.test/olva/shipments/${ID}/payment-link`);
    expect(http.get.mock.calls[1][0]).toBe(`http://api.test/olva/shipments/${ID}/label`);
  });
});
