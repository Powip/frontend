import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBulkUnknownItemResponse,
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
  discardOlvaShipment,
  getOlvaShipment,
  getOlvaShipmentLabel,
  getOlvaShipments,
  regenerateOlvaShipmentPaymentLink,
  retryOlvaShipment,
} from "../services/olva-shipment.service";

const ID = "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b";

describe("olva-shipment service", () => {
  beforeEach(() => {
    http.get.mockReset();
    http.post.mockReset();
  });

  it("creates with the compacted body and no Idempotency-Key: the backend keys each order itself", async () => {
    http.post.mockResolvedValue({ data: buildCreateOlvaShipmentResponse() });

    const shipment = await createOlvaShipment(buildCreateOlvaShipmentInput());

    const [url, body, config] = http.post.mock.calls[0];
    expect(url).toBe("http://api.test/olva/shipments");
    expect(body.origin).toEqual({ headquarterId: "12" });
    expect(config).toBeUndefined();
    expect(shipment.label?.pdfBase64).toBe("JVBERg==");
  });

  it("retries a registration Olva did not confirm and answers like an item of the lot", async () => {
    http.post.mockResolvedValue({ data: buildBulkUnknownItemResponse("x") });

    const result = await retryOlvaShipment({ id: ID, confirmed: true });

    expect(http.post).toHaveBeenCalledWith(`http://api.test/olva/shipments/${ID}/retry`, {
      confirmed: true,
    });
    expect(result.status).toBe("unknown");
  });

  it("discards a shipment whose payment expired", async () => {
    http.post.mockResolvedValue({ data: buildOlvaShipmentResponse({ status: "DISCARDED" }) });

    const shipment = await discardOlvaShipment(ID);

    expect(http.post).toHaveBeenCalledWith(`http://api.test/olva/shipments/${ID}/discard`);
    expect(shipment.status).toBe("DISCARDED");
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
