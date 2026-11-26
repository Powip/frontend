import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOlvaAxiosError } from "../../shared/test-utils/axios-error";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";
import { buildCreateOlvaShipmentInput } from "../test-utils/olva-shipment.fixtures";

const service = vi.hoisted(() => ({
  createOlvaShipment: vi.fn(),
  getOlvaShipments: vi.fn(),
  getOlvaShipment: vi.fn(),
  getOlvaShipmentLabel: vi.fn(),
  regenerateOlvaShipmentPaymentLink: vi.fn(),
  retryOlvaShipment: vi.fn(),
  discardOlvaShipment: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("../services/olva-shipment.service", () => service);
vi.mock("sonner", () => ({ toast }));

import { useCreateOlvaShipment } from "../hooks/use-create-olva-shipment";
import { useDiscardOlvaShipment } from "../hooks/use-discard-olva-shipment";
import { useOlvaShipment } from "../hooks/use-olva-shipment";
import { useOlvaShipmentByOrder } from "../hooks/use-olva-shipment-by-order";
import { useOlvaShipmentLabel } from "../hooks/use-olva-shipment-label";
import { useOlvaShipments } from "../hooks/use-olva-shipments";
import { useRegenerateOlvaShipmentPaymentLink } from "../hooks/use-regenerate-olva-shipment-payment-link";
import { useRetryOlvaShipment } from "../hooks/use-retry-olva-shipment";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";

const createdShipment = {
  id: "s-1",
  status: "REGISTERED",
  label: { filename: "g.pdf", mimeType: "application/pdf", pdfBase64: "AA==" },
};

describe("olva-shipment hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detail and label stay idle without an id", () => {
    const { wrapper } = createQueryClientWrapper();

    const detail = renderHook(() => useOlvaShipment(null), { wrapper });
    const label = renderHook(() => useOlvaShipmentLabel(undefined), { wrapper });

    expect(detail.result.current.fetchStatus).toBe("idle");
    expect(label.result.current.fetchStatus).toBe("idle");
    expect(service.getOlvaShipment).not.toHaveBeenCalled();
    expect(service.getOlvaShipmentLabel).not.toHaveBeenCalled();
  });

  it("by-order lookup stays idle for a blank order and filters the list otherwise", async () => {
    service.getOlvaShipments.mockResolvedValue({
      items: [],
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 0,
    });
    const { wrapper } = createQueryClientWrapper();

    const blank = renderHook(() => useOlvaShipmentByOrder("  "), { wrapper });
    expect(blank.result.current.fetchStatus).toBe("idle");
    expect(service.getOlvaShipments).not.toHaveBeenCalled();

    const { result } = renderHook(() => useOlvaShipmentByOrder(" PED-1 "), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getOlvaShipments.mock.calls[0][0]).toEqual({ orderId: "PED-1", limit: 5 });
  });

  it("lists with normalized filters", async () => {
    service.getOlvaShipments.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    const { wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaShipments({ q: " ", page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getOlvaShipments.mock.calls[0][0]).toEqual({ page: 1 });
  });

  it("polls the detail only while the payment is pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service.getOlvaShipment
      .mockResolvedValueOnce({ id: "s-1", status: "PENDING_PAYMENT" })
      .mockResolvedValue({ id: "s-1", status: "REGISTERED" });
    const { wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaShipment("s-1"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("PENDING_PAYMENT"));

    await vi.advanceTimersByTimeAsync(60_000);
    await waitFor(() => expect(result.current.data?.status).toBe("REGISTERED"));

    const calls = service.getOlvaShipment.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(service.getOlvaShipment).toHaveBeenCalledTimes(calls);
    vi.useRealTimers();
  });

  it("re-reads a pending payment once a minute, never every few seconds (Olva allows 60 req/min for every company)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service.getOlvaShipment.mockResolvedValue({ id: "s-1", status: "PENDING_PAYMENT" });
    const { wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaShipment("s-1"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("PENDING_PAYMENT"));
    const first = service.getOlvaShipment.mock.calls.length;

    await vi.advanceTimersByTimeAsync(45_000);
    expect(service.getOlvaShipment).toHaveBeenCalledTimes(first);

    await vi.advanceTimersByTimeAsync(16_000);
    await waitFor(() => expect(service.getOlvaShipment).toHaveBeenCalledTimes(first + 1));
    vi.useRealTimers();
  });

  it("creates with the form input as is and keeps the heavy label out of the cache", async () => {
    service.createOlvaShipment
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(createdShipment);
    const { wrapper, queryClient } = createQueryClientWrapper();
    const { result } = renderHook(() => useCreateOlvaShipment(), { wrapper });
    const input = buildCreateOlvaShipmentInput();

    await expect(result.current.mutateAsync(input)).rejects.toThrow("timeout");
    await result.current.mutateAsync(input);

    expect(service.createOlvaShipment.mock.calls.map(([variables]) => variables)).toEqual([
      input,
      input,
    ]);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("s-1"))).not.toHaveProperty("label");
  });

  it("regenerating the payment link updates the cached detail", async () => {
    service.regenerateOlvaShipmentPaymentLink.mockResolvedValue({
      id: "s-1",
      status: "PENDING_PAYMENT",
    });
    const { wrapper, queryClient } = createQueryClientWrapper();
    const { result } = renderHook(() => useRegenerateOlvaShipmentPaymentLink(), { wrapper });

    result.current.mutate("s-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.regenerateOlvaShipmentPaymentLink.mock.calls[0][0]).toBe("s-1");
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("s-1"))).toMatchObject({
      status: "PENDING_PAYMENT",
    });
  });

  describe("retry and discard (FEAT-35)", () => {
    it("retry sends the confirmation, caches the shipment it answers and refreshes the lists", async () => {
      service.retryOlvaShipment.mockResolvedValue({
        status: "created",
        itemKey: "s-1",
        shipment: { id: "s-1", status: "PENDING_PAYMENT" },
        label: null,
      });
      const { wrapper, queryClient } = createQueryClientWrapper();
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useRetryOlvaShipment(), { wrapper });

      result.current.mutate({ id: "s-1", confirmed: true });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(service.retryOlvaShipment.mock.calls[0][0]).toEqual({ id: "s-1", confirmed: true });
      expect(queryClient.getQueryData(olvaShipmentKeys.detail("s-1"))).toMatchObject({
        status: "PENDING_PAYMENT",
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: olvaShipmentKeys.lists() });
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("retry that Olva still does not confirm warns instead of celebrating", async () => {
      service.retryOlvaShipment.mockResolvedValue({
        status: "unknown",
        itemKey: "s-1",
        shipment: { id: "s-1", status: "SUBMITTING" },
        error: { code: "OLVA_OUTCOME_UNKNOWN", message: "x" },
      });
      const { wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useRetryOlvaShipment(), { wrapper });

      result.current.mutate({ id: "s-1" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("a manual review is left to the screen (it asks the user to confirm), not toasted", async () => {
      service.retryOlvaShipment.mockRejectedValue(
        buildOlvaAxiosError(409, {
          details: { code: "SHIPMENT_MANUAL_REVIEW", shipmentId: "s-1" },
        }),
      );
      const { wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useRetryOlvaShipment(), { wrapper });

      result.current.mutate({ id: "s-1" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("discard caches the discarded shipment and refreshes the lists", async () => {
      service.discardOlvaShipment.mockResolvedValue({ id: "s-1", status: "DISCARDED" });
      const { wrapper, queryClient } = createQueryClientWrapper();
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useDiscardOlvaShipment(), { wrapper });

      result.current.mutate("s-1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(service.discardOlvaShipment.mock.calls[0][0]).toBe("s-1");
      expect(queryClient.getQueryData(olvaShipmentKeys.detail("s-1"))).toMatchObject({
        status: "DISCARDED",
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: olvaShipmentKeys.lists() });
    });
  });
});
