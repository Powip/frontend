import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkCreateOlvaShipmentsSchema } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { buildOlvaAxiosError } from "@/features/olva/shared/test-utils/axios-error";
import { createQueryClientWrapper } from "@/features/olva/shared/test-utils/create-query-client-wrapper";
import { useOlvaActiveShipmentsByOrder } from "../hooks/use-olva-active-shipments-by-order";
import { useSendToOlvaPhase } from "../hooks/use-send-to-olva-phase";
import { useSendToOlvaSubmit } from "../hooks/use-send-to-olva-submit";
import {
  buildBulkResult,
  buildOrderDetail,
  buildShipmentSummary,
} from "../test-utils/send-to-olva.fixtures";
import { buildOlvaFormDefaults } from "../utils/build-olva-form-defaults";

const { bulkCreateOlvaShipments, getOlvaShipments } = vi.hoisted(() => ({
  bulkCreateOlvaShipments: vi.fn(),
  getOlvaShipments: vi.fn(),
}));

vi.mock("@/features/olva/olva-shipment/services/olva-shipment.service", () => ({
  bulkCreateOlvaShipments,
  getOlvaShipments,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

describe("useSendToOlvaPhase", () => {
  it("starts on the form and moves to the results when they arrive", () => {
    const { result } = renderHook(() => useSendToOlvaPhase());

    expect(result.current.view).toBe("edit");

    act(() =>
      result.current.showResults(buildBulkResult([{ key: "a", status: "created" }]).results),
    );

    expect(result.current.view).toBe("results");
    expect(result.current.results).toHaveLength(1);
  });

  it("keeps earlier results when the user goes back to fix and retry", () => {
    const { result } = renderHook(() => useSendToOlvaPhase());

    act(() =>
      result.current.showResults(
        buildBulkResult([
          { key: "a", status: "created" },
          { key: "b", status: "failed" },
        ]).results,
      ),
    );
    act(() => result.current.backToEdit());

    expect(result.current.view).toBe("edit");
    expect(result.current.results).toHaveLength(2);

    act(() =>
      result.current.showResults(buildBulkResult([{ key: "b", status: "created" }]).results),
    );

    expect(result.current.results.map((item) => item.status)).toEqual(["created", "created"]);
  });
});

describe("useOlvaActiveShipmentsByOrder", () => {
  beforeEach(() => {
    getOlvaShipments.mockResolvedValue({
      items: [buildShipmentSummary("a"), buildShipmentSummary("b", "REJECTED")],
      page: 1,
      limit: 100,
      total: 2,
      totalPages: 1,
    });
  });

  it("maps the guide's active shipments by order and asks only for that guide", async () => {
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useOlvaActiveShipmentsByOrder("guide-1"), { wrapper });

    await waitFor(() => expect(result.current.isSettled).toBe(true));

    expect([...(result.current.activeByOrder?.keys() ?? [])]).toEqual(["a"]);
    expect(getOlvaShipments).toHaveBeenCalledWith(expect.objectContaining({ guideId: "guide-1" }));
  });

  it("does not ask for anything without a guide, and has nothing to wait for", () => {
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useOlvaActiveShipmentsByOrder(undefined), { wrapper });

    expect(result.current.isSettled).toBe(true);
    expect(getOlvaShipments).not.toHaveBeenCalled();
  });

  it("does not block sending when the lookup fails", async () => {
    // A 4xx is not retried, so the failure shows right away
    getOlvaShipments.mockRejectedValue(buildOlvaAxiosError(403));

    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useOlvaActiveShipmentsByOrder("guide-1"), { wrapper });

    await waitFor(() => expect(result.current.isSettled).toBe(true));

    expect(result.current.isError).toBe(true);
  });
});

describe("useSendToOlvaSubmit", () => {
  const values = bulkCreateOlvaShipmentsSchema.parse({
    items: [
      {
        ...buildOlvaFormDefaults([buildOrderDetail()]).items[0],
        origin: { headquarterId: "12" },
        destination: { agencyCode: "LIM01", address: "" },
      },
    ],
  });

  it("sends the lot once and hands every outcome to onResult", async () => {
    const lot = buildBulkResult([{ key: "order-1", status: "created" }]);

    bulkCreateOlvaShipments.mockResolvedValue(lot);

    const onResult = vi.fn();
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useSendToOlvaSubmit({ onResult }), { wrapper });

    await act(() => result.current.submit(values));

    expect(bulkCreateOlvaShipments).toHaveBeenCalledTimes(1);
    expect(bulkCreateOlvaShipments.mock.calls[0][0].items[0]).toMatchObject({
      itemKey: "order-1",
      externalRef: { orderId: "order-1" },
    });
    expect(onResult).toHaveBeenCalledWith(lot);
  });

  it("does not throw nor report results when the whole call fails", async () => {
    bulkCreateOlvaShipments.mockRejectedValue(new Error("timeout"));

    const onResult = vi.fn();
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useSendToOlvaSubmit({ onResult }), { wrapper });

    await act(() => result.current.submit(values));

    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});
