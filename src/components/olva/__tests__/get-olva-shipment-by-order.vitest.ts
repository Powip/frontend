import { describe, expect, it } from "vitest";
import { toOlvaShipmentSummary } from "@/features/olva/olva-shipment/mappers/to-olva-shipment-summary";
import { buildOlvaShipmentListItemResponse } from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";
import type { OlvaShipmentStatus } from "@/features/olva/shared/constants/olva-enums.constants";
import { getOlvaShipmentByOrder } from "../utils/get-olva-shipment-by-order";

const shipment = (
  id: string,
  orderId: string | null,
  status: OlvaShipmentStatus,
  createdAt: string,
) =>
  toOlvaShipmentSummary(
    buildOlvaShipmentListItemResponse({
      id,
      status,
      createdAt,
      externalRef: orderId ? { orderId, guideId: "g-1" } : null,
    }),
  );

describe("getOlvaShipmentByOrder", () => {
  it("shows per order the shipment that holds it, else its newest one", () => {
    const byOrder = getOlvaShipmentByOrder([
      shipment("a-failed", "A", "FAILED", "2026-11-20T10:00:00.000Z"),
      shipment("a-active", "A", "REGISTERED", "2026-11-20T11:00:00.000Z"),
      shipment("b-old", "B", "FAILED", "2026-11-20T10:00:00.000Z"),
      shipment("b-new", "B", "DISCARDED", "2026-11-21T10:00:00.000Z"),
      shipment("c-returned", "C", "RETURNED", "2026-11-22T10:00:00.000Z"),
      shipment("c-held", "C", "PENDING_PAYMENT", "2026-11-19T10:00:00.000Z"),
      shipment("loose", null, "REGISTERED", "2026-11-20T10:00:00.000Z"),
    ]);

    expect([...byOrder.entries()].map(([order, item]) => [order, item.id])).toEqual([
      ["A", "a-active"],
      ["B", "b-new"],
      ["C", "c-held"],
    ]);
  });
});
