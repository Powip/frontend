import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTrackOlvaBatchResponse,
  buildTrackOlvaShipmentResponse,
} from "../test-utils/olva-tracking.fixtures";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { post } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import { trackOlvaShipment, trackOlvaShipmentsBatch } from "../services/olva-tracking.service";

describe("olva-tracking service", () => {
  beforeEach(() => post.mockReset());

  it("tracks one guide, trimming and dropping a blank orderCode", async () => {
    post.mockResolvedValue({ data: buildTrackOlvaShipmentResponse() });

    const tracking = await trackOlvaShipment({ orderNumber: " 123456789012 ", orderCode: " " });

    expect(post.mock.calls[0][0]).toBe("http://api.test/olva/track");
    expect(post.mock.calls[0][1]).toEqual({ orderNumber: "123456789012" });
    expect(tracking.events).toHaveLength(2);
    // Dates stay as plain "YYYY-MM-DD" text
    expect(tracking.estimatedDelivery).toBe("2026-10-26");
  });

  it("sends the batch and narrows each item on `success`", async () => {
    post.mockResolvedValue({ data: buildTrackOlvaBatchResponse() });

    const items = await trackOlvaShipmentsBatch([
      { orderNumber: "123456789012" },
      { orderNumber: "999999", orderCode: "26" },
    ]);

    expect(post.mock.calls[0][0]).toBe("http://api.test/olva/track/batch");
    expect(post.mock.calls[0][1]).toEqual({
      shipments: [{ orderNumber: "123456789012" }, { orderNumber: "999999", orderCode: "26" }],
    });

    const [first, second] = items;
    expect(first.success && first.tracking.trackingNumber).toBe("123456789012");
    expect(first).not.toHaveProperty("status");
    expect(second).toEqual({
      success: false,
      orderNumber: "999999",
      orderCode: "26",
      error: "Guía no encontrada",
    });
  });
});
