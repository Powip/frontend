import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBulkCreatedItemResponse,
  buildBulkCreateShipmentsResponse,
  buildBulkFailedItemResponse,
  buildBulkNotSavedItemResponse,
  buildBulkOlvaShipmentItemInput,
  buildOlvaShipmentResponse,
} from "../test-utils/olva-shipment.fixtures";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { post } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import { bulkCreateOlvaShipments } from "../services/olva-shipment.service";

describe("bulkCreateOlvaShipments", () => {
  beforeEach(() => post.mockReset());

  it("posts the lot to /bulk without an idempotency key and compacts every item", async () => {
    post.mockResolvedValue({
      data: buildBulkCreateShipmentsResponse([buildBulkCreatedItemResponse("PED-1")]),
    });

    await bulkCreateOlvaShipments({
      senderProfileId: "",
      items: [buildBulkOlvaShipmentItemInput(" PED-1 ")],
    });

    const [url, body, config] = post.mock.calls[0];

    expect(url).toBe("http://api.test/olva/shipments/bulk");
    expect(config).toBeUndefined();
    expect(body).not.toHaveProperty("senderProfileId");
    expect(body.items[0]).toMatchObject({
      itemKey: "PED-1",
      origin: { headquarterId: "12" },
      package: { weightKg: 1.5, declaredValue: 80 },
    });
    expect(body.items[0]).not.toHaveProperty("confirm");
    expect(body.items[0].recipient).not.toHaveProperty("email");
  });

  it("narrows each result by status, in request order", async () => {
    const holder = buildOlvaShipmentResponse({ id: "holder" });
    post.mockResolvedValue({
      data: buildBulkCreateShipmentsResponse([
        buildBulkCreatedItemResponse("A"),
        buildBulkNotSavedItemResponse("B"),
        buildBulkFailedItemResponse("C", "SHIPMENT_ALREADY_EXISTS", holder),
        buildBulkFailedItemResponse("D"),
      ]),
    });

    const { summary, results } = await bulkCreateOlvaShipments({ items: [] });

    expect(summary).toEqual({ total: 4, created: 1, registeredNotSaved: 1, failed: 2 });
    expect(results.map((r) => r.itemKey)).toEqual(["A", "B", "C", "D"]);

    const [created, notSaved, existing, rejected] = results;

    expect(created.status === "created" && created.shipment.createdAt).toBeInstanceOf(Date);
    expect(created.status === "created" && created.label?.filename).toBe("guia.pdf");
    expect(
      notSaved.status === "registered_not_saved" && notSaved.registeredInOlva.payment?.expiresAt,
    ).toEqual(new Date("2026-10-30T00:00:00.000Z"));
    expect(existing.status === "failed" && existing.existingShipment?.id).toBe("holder");
    expect(rejected.status === "failed" && rejected.existingShipment).toBeNull();
  });

  it("fails loudly on an answer that breaks the contract", async () => {
    post.mockResolvedValue({
      data: buildBulkCreateShipmentsResponse([
        { ...buildBulkCreatedItemResponse("A"), shipment: null },
      ]),
    });

    await expect(bulkCreateOlvaShipments({ items: [] })).rejects.toThrow("creado sin envío");
  });
});
