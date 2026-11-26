import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOlvaAxiosError } from "../../shared/test-utils/axios-error";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import { toOlvaBulkCreateShipmentsResult } from "../mappers/to-olva-bulk-create-shipments-result";
import {
  buildBulkCreatedItemResponse,
  buildBulkCreateShipmentsResponse,
  buildBulkFailedItemResponse,
  buildBulkNotSavedItemResponse,
  buildBulkOlvaShipmentItemInput,
  buildOlvaShipmentResponse,
} from "../test-utils/olva-shipment.fixtures";

const service = vi.hoisted(() => ({
  bulkCreateOlvaShipments: vi.fn(),
  createOlvaShipment: vi.fn(),
  getOlvaShipments: vi.fn(),
  getOlvaShipment: vi.fn(),
  getOlvaShipmentLabel: vi.fn(),
  regenerateOlvaShipmentPaymentLink: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));

vi.mock("../services/olva-shipment.service", () => service);
vi.mock("sonner", () => ({ toast }));

import { useBulkCreateOlvaShipments } from "../hooks/use-bulk-create-olva-shipments";

const input = { items: [buildBulkOlvaShipmentItemInput("A")] };
const resultOf = (items: Parameters<typeof buildBulkCreateShipmentsResponse>[0]) =>
  toOlvaBulkCreateShipmentsResult(buildBulkCreateShipmentsResponse(items));

describe("useBulkCreateOlvaShipments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caches created details (without the label) and the order holder, then refreshes lists", async () => {
    const holder = buildOlvaShipmentResponse({ id: "holder" });
    service.bulkCreateOlvaShipments.mockResolvedValue(
      resultOf([
        buildBulkCreatedItemResponse("A"),
        buildBulkFailedItemResponse("B", "SHIPMENT_ALREADY_EXISTS", holder),
      ]),
    );
    const { wrapper, queryClient } = createQueryClientWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBulkCreateOlvaShipments(), { wrapper });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.bulkCreateOlvaShipments.mock.calls[0][0]).toEqual(input);
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("id-A"))).toMatchObject({
      id: "id-A",
    });
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("id-A"))).not.toHaveProperty("label");
    expect(queryClient.getQueryData(olvaShipmentKeys.detail("holder"))).toBeDefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: olvaShipmentKeys.lists() });
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("1 de 2 envíos creados"));
  });

  it("toasts by the summary tone", async () => {
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useBulkCreateOlvaShipments(), { wrapper });

    service.bulkCreateOlvaShipments.mockResolvedValueOnce(
      resultOf([buildBulkCreatedItemResponse("A")]),
    );
    await result.current.mutateAsync(input);
    expect(toast.success).toHaveBeenCalledTimes(1);

    service.bulkCreateOlvaShipments.mockResolvedValueOnce(
      resultOf([buildBulkNotSavedItemResponse("A")]),
    );
    await result.current.mutateAsync(input);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("No los envíes de nuevo"));
  });

  it("an unknown outcome refreshes the lists and explains what to do; nothing is retried", async () => {
    service.bulkCreateOlvaShipments.mockRejectedValue(
      buildOlvaAxiosError(502, { details: { code: "OLVA_OUTCOME_UNKNOWN" } }),
    );
    const { wrapper, queryClient } = createQueryClientWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBulkCreateOlvaShipments(), { wrapper });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: olvaShipmentKeys.lists() });
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Revisa tu lista de envíos"));
    expect(service.bulkCreateOlvaShipments).toHaveBeenCalledTimes(1);
  });

  it("a rate limit tells how long to wait", async () => {
    service.bulkCreateOlvaShipments.mockRejectedValue(
      buildOlvaAxiosError(429, { details: { code: "OLVA_RATE_LIMITED" }, retryAfter: 45 }),
    );
    const { wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useBulkCreateOlvaShipments(), { wrapper });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("45 segundos"));
  });
});
