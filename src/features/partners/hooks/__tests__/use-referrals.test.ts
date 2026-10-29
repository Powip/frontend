import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { PartnerReferral } from "../../models/partner-referral";
import { getReferrals } from "../../services/get-referrals";
import { useReferrals } from "../use-referrals";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "fixture-user" }, accessToken: "fixture-token" } }),
}));

jest.mock("../../services/get-referrals", () => ({
  getReferrals: jest.fn(),
}));

const mockGetReferrals = jest.mocked(getReferrals);

function makeReferral(id: string): PartnerReferral {
  return {
    id,
    businessName: `Negocio ${id}`,
    origin: "link",
    status: "cuenta_creada",
    registeredAt: "2026-09-24T15:00:00Z",
    planName: null,
    firstMonthCommission: null,
    recurringCommission: null,
  };
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function PartnersQueryTestWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useReferrals", () => {
  beforeEach(() => {
    mockGetReferrals.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetReferrals.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("pide la primera página sin cursor y expone sus items", async () => {
    mockGetReferrals.mockResolvedValue({ items: [makeReferral("1")], nextCursor: null });
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetReferrals).toHaveBeenCalledWith(null);
    expect(result.current.data?.pages[0].items).toEqual([makeReferral("1")]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("usa nextCursor para pedir la página siguiente y acumula las páginas", async () => {
    mockGetReferrals
      .mockResolvedValueOnce({ items: [makeReferral("1")], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [makeReferral("2")], nextCursor: null });
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockGetReferrals).toHaveBeenLastCalledWith("cursor-2");
    await waitFor(() =>
      expect(
        result.current.data?.pages.flatMap((page) => page.items.map((item) => item.id)),
      ).toEqual(["1", "2"]),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetReferrals.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
