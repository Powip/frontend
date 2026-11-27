import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";

const service = vi.hoisted(() => ({
  getOlvaAgencies: vi.fn(),
  getNearestOlvaAgencies: vi.fn(),
  getOlvaAgencyDepartments: vi.fn(),
  getOlvaAgencyProvinces: vi.fn(),
  getOlvaAgencyDistricts: vi.fn(),
  getOlvaAgency: vi.fn(),
}));

vi.mock("../services/olva-agency.service", () => service);

import { useNearestOlvaAgencies } from "../hooks/use-nearest-olva-agencies";
import { useOlvaAgencies } from "../hooks/use-olva-agencies";
import { useOlvaAgency } from "../hooks/use-olva-agency";
import { useOlvaAgencyProvinces } from "../hooks/use-olva-agency-provinces";

describe("olva-agency hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("provinces stay idle until a department is chosen", async () => {
    service.getOlvaAgencyProvinces.mockResolvedValue([{ name: "LIMA", agencyCount: 1 }]);
    const { wrapper } = createQueryClientWrapper();

    const { result, rerender } = renderHook(({ d }) => useOlvaAgencyProvinces(d), {
      wrapper,
      initialProps: { d: null as string | null },
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(service.getOlvaAgencyProvinces).not.toHaveBeenCalled();

    rerender({ d: "LIMA" });

    await waitFor(() => expect(result.current.data).toEqual([{ name: "LIMA", agencyCount: 1 }]));
    expect(service.getOlvaAgencyProvinces.mock.calls[0][0]).toBe("LIMA");
  });

  it("nearest ignores a null or out-of-range position", () => {
    const { wrapper } = createQueryClientWrapper();

    const nullPosition = renderHook(() => useNearestOlvaAgencies(null), { wrapper });
    const badPosition = renderHook(() => useNearestOlvaAgencies({ latitude: 200, longitude: 0 }), {
      wrapper,
    });

    expect(nullPosition.result.current.fetchStatus).toBe("idle");
    expect(badPosition.result.current.fetchStatus).toBe("idle");
    expect(service.getNearestOlvaAgencies).not.toHaveBeenCalled();
  });

  it("lists agencies with normalized filters", async () => {
    service.getOlvaAgencies.mockResolvedValue([]);
    const { wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useOlvaAgencies({ q: " sur " }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getOlvaAgencies.mock.calls[0][0]).toEqual({ q: "sur" });
  });

  it("does not retry an unknown agency (404)", async () => {
    const { buildOlvaAxiosError } = await import("../../shared/test-utils/axios-error");
    service.getOlvaAgency.mockRejectedValue(buildOlvaAxiosError(404));
    const { queryClient } = createQueryClientWrapper();
    const { createElement } = await import("react");
    const { QueryClientProvider } = await import("@tanstack/react-query");
    queryClient.setDefaultOptions({ queries: {} });

    const { result } = renderHook(() => useOlvaAgency("NOPE"), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(service.getOlvaAgency).toHaveBeenCalledTimes(1);
  });
});
