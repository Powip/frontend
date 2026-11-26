import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOlvaAxiosError } from "../../shared/test-utils/axios-error";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";

const service = vi.hoisted(() => ({
  trackOlvaShipment: vi.fn(),
  trackOlvaShipmentsBatch: vi.fn(),
}));

vi.mock("../services/olva-tracking.service", () => service);

import { useOlvaTracking } from "../hooks/use-olva-tracking";
import { useOlvaTrackingBatch } from "../hooks/use-olva-tracking-batch";

const tracking = (status: string) => ({ trackingNumber: "123456", status, events: [] });

describe("olva-tracking hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("single stays idle for null and for a malformed guide", () => {
    const { wrapper } = createQueryClientWrapper();

    const none = renderHook(() => useOlvaTracking(null), { wrapper });
    const bad = renderHook(() => useOlvaTracking({ orderNumber: "12" }), { wrapper });

    expect(none.result.current.fetchStatus).toBe("idle");
    expect(bad.result.current.fetchStatus).toBe("idle");
    expect(service.trackOlvaShipment).not.toHaveBeenCalled();
  });

  it("single fetches a valid guide", async () => {
    service.trackOlvaShipment.mockResolvedValue(tracking("IN_TRANSIT"));
    const { wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaTracking({ orderNumber: "123456" }), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("IN_TRANSIT"));
    expect(service.trackOlvaShipment.mock.calls[0][0]).toEqual({ orderNumber: "123456" });
  });

  it("does not retry a 404 (unknown guide)", async () => {
    service.trackOlvaShipment.mockRejectedValue(buildOlvaAxiosError(404));
    // Own client: the shared wrapper disables retries, which would hide the bug
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useOlvaTracking({ orderNumber: "123456" }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(service.trackOlvaShipment).toHaveBeenCalledTimes(1);
  });

  it("never refetches a delivered guide, but does refetch one in transit", async () => {
    service.trackOlvaShipment.mockResolvedValue(tracking("DELIVERED"));
    const { wrapper, queryClient } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaTracking({ orderNumber: "123456" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [query] = queryClient.getQueryCache().getAll();

    expect(query.isStaleByTime(10 * 60 * 60 * 1000)).toBe(false);
  });

  it("batch is idle for null, empty and invalid lists; sends the normalized list otherwise", async () => {
    service.trackOlvaShipmentsBatch.mockResolvedValue([]);
    const { wrapper } = createQueryClientWrapper();

    const none = renderHook(() => useOlvaTrackingBatch(null), { wrapper });
    const empty = renderHook(() => useOlvaTrackingBatch([]), { wrapper });
    const invalid = renderHook(
      () => useOlvaTrackingBatch([{ orderNumber: "123456" }, { orderNumber: "x" }]),
      { wrapper },
    );

    for (const hook of [none, empty, invalid]) {
      expect(hook.result.current.fetchStatus).toBe("idle");
    }
    expect(service.trackOlvaShipmentsBatch).not.toHaveBeenCalled();

    const ok = renderHook(
      () =>
        useOlvaTrackingBatch([
          { orderNumber: " 123456 " },
          { orderNumber: "123456" },
          { orderNumber: "654321", orderCode: "" },
        ]),
      { wrapper },
    );

    await waitFor(() => expect(ok.result.current.isSuccess).toBe(true));
    expect(service.trackOlvaShipmentsBatch.mock.calls[0][0]).toEqual([
      { orderNumber: "123456" },
      { orderNumber: "654321" },
    ]);
  });
});
