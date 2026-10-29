import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { PartnerApplication } from "../../models/partner-application";
import { getAdminApplications } from "../../services/get-admin-applications";
import { buildAxiosError } from "../../test-utils/axios-error";
import { shouldRetryPartnersQuery, useAdminApplications } from "../use-admin-applications";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "fixture-user" }, accessToken: "fixture-token" } }),
}));

jest.mock("../../services/get-admin-applications", () => ({
  getAdminApplications: jest.fn(),
}));

const mockGetAdminApplications = jest.mocked(getAdminApplications);

function buildApplication(id: string): PartnerApplication {
  return {
    id,
    reference: `APP-${id}`,
    email: `${id}@example.com`,
    displayName: `Partner ${id}`,
    country: "PE",
    status: "applied",
    rawStatus: "APPLIED",
    appliedAt: "2026-09-24T15:00:00Z",
  };
}

function buildWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 0 } } });
  return function PartnersQueryTestWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAdminApplications", () => {
  beforeEach(() => {
    mockGetAdminApplications.mockReset();
  });

  it("pagina por cursor: la primera página sin cursor y la siguiente con nextCursor", async () => {
    mockGetAdminApplications
      .mockResolvedValueOnce({ items: [buildApplication("a")], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [buildApplication("b")], nextCursor: null });

    const { result } = renderHook(() => useAdminApplications("APPLIED"), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAdminApplications).toHaveBeenNthCalledWith(1, {
      cursor: null,
      status: "APPLIED",
    });
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    expect(mockGetAdminApplications).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-2",
      status: "APPLIED",
    });
    await waitFor(() =>
      expect(
        result.current.data?.pages.flatMap((page) => page.items.map((item) => item.id)),
      ).toEqual(["a", "b"]),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("no envía filtro de estado cuando se piden todas", async () => {
    mockGetAdminApplications.mockResolvedValue({ items: [], nextCursor: null });

    const { result } = renderHook(() => useAdminApplications(null), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAdminApplications).toHaveBeenCalledWith({ cursor: null, status: null });
  });

  it("no reintenta automáticamente ante un 429 ni usa datos simulados", async () => {
    mockGetAdminApplications.mockRejectedValue(buildAxiosError(429));

    const { result } = renderHook(() => useAdminApplications("APPLIED"), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetAdminApplications).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });
});

describe("shouldRetryPartnersQuery", () => {
  it.each([401, 403, 404, 409, 429])("no reintenta un %i", (status) => {
    expect(shouldRetryPartnersQuery(0, buildAxiosError(status))).toBe(false);
  });

  it("reintenta una vez un error transitorio", () => {
    expect(shouldRetryPartnersQuery(0, buildAxiosError(503))).toBe(true);
    expect(shouldRetryPartnersQuery(1, buildAxiosError(503))).toBe(false);
    expect(shouldRetryPartnersQuery(0, buildAxiosError())).toBe(true);
  });
});
