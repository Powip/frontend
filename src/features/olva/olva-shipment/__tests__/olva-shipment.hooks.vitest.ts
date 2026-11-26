import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";
import { buildCreateOlvaShipmentInput } from "../test-utils/olva-shipment.fixtures";

const service = vi.hoisted(() => ({
  createOlvaShipment: vi.fn(),
  getOlvaShipments: vi.fn(),
  getOlvaShipment: vi.fn(),
  getOlvaShipmentLabel: vi.fn(),
  regenerateOlvaShipmentPaymentLink: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../services/olva-shipment.service", () => service);
vi.mock("sonner", () => ({ toast }));

import { useCreateOlvaShipment } from "../hooks/use-create-olva-shipment";
import { useOlvaShipment } from "../hooks/use-olva-shipment";
import { useOlvaShipmentByOrder } from "../hooks/use-olva-shipment-by-order";
import { useOlvaShipmentLabel } from "../hooks/use-olva-shipment-label";
import { useOlvaShipments } from "../hooks/use-olva-shipments";
import { useRegenerateOlvaShipmentPaymentLink } from "../hooks/use-regenerate-olva-shipment-payment-link";
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

    await vi.advanceTimersByTimeAsync(15_000);
    await waitFor(() => expect(result.current.data?.status).toBe("REGISTERED"));

    const calls = service.getOlvaShipment.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(service.getOlvaShipment).toHaveBeenCalledTimes(calls);
    vi.useRealTimers();
  });

  it("reuses the idempotency key after a failure and renews it after a success", async () => {
    service.createOlvaShipment
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(createdShipment)
      .mockResolvedValueOnce(createdShipment);
    const { wrapper, queryClient } = createQueryClientWrapper();
    const { result } = renderHook(() => useCreateOlvaShipment(), { wrapper });
    const input = buildCreateOlvaShipmentInput();

    await expect(result.current.mutateAsync(input)).rejects.toThrow("timeout");
    await result.current.mutateAsync(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await result.current.mutateAsync(input);

    const keys = service.createOlvaShipment.mock.calls.map(
      ([variables]) => variables.idempotencyKey,
    );

    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(2);
    // The heavy label is not cached with the detail
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("s-1"))).not.toHaveProperty("label");
  });

  it("reset() starts a new idempotency key", async () => {
    service.createOlvaShipment.mockRejectedValue(new Error("boom"));
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useCreateOlvaShipment(), { wrapper });
    const input = buildCreateOlvaShipmentInput();

    await expect(result.current.mutateAsync(input)).rejects.toThrow();
    result.current.reset();
    await expect(result.current.mutateAsync(input)).rejects.toThrow();

    const [first, second] = service.createOlvaShipment.mock.calls.map(
      ([variables]) => variables.idempotencyKey,
    );

    expect(first).not.toBe(second);
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
});
