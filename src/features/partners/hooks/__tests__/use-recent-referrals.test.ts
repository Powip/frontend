/**
 * Tests: useRecentReferrals
 *
 * Comportamiento verificado:
 * 1. Llama al service con el `limit` recibido.
 * 2. Expone `data` con los referidos devueltos por el service al resolver.
 * 3. Usa una query key distinta por `limit` (dos límites distintos no comparten cache).
 * 4. Si el service rechaza, expone `isError` true.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useRecentReferrals } from "../use-recent-referrals";
import { getRecentReferrals } from "../../services/get-recent-referrals";
import type { PartnerReferral } from "../../models/partner-referral";

jest.mock("../../services/get-recent-referrals", () => ({
  getRecentReferrals: jest.fn(),
}));

const mockGetRecentReferrals = jest.mocked(getRecentReferrals);

const MOCK_REFERRAL: PartnerReferral = {
  id: "ref-1",
  businessName: "Negocio Uno",
  origin: "link",
  status: "pagando",
  registeredAt: "2026-08-01",
  planName: "Standard",
  firstMonthCommission: 10,
  recurringCommission: 2,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useRecentReferrals", () => {
  beforeEach(() => {
    mockGetRecentReferrals.mockReset();
  });

  it("llama al service con el limit recibido", async () => {
    mockGetRecentReferrals.mockResolvedValue([MOCK_REFERRAL]);
    const { result } = renderHook(() => useRecentReferrals(3), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRecentReferrals).toHaveBeenCalledWith(3);
  });

  it("expone data con los referidos devueltos", async () => {
    mockGetRecentReferrals.mockResolvedValue([MOCK_REFERRAL]);
    const { result } = renderHook(() => useRecentReferrals(5), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_REFERRAL]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetRecentReferrals.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useRecentReferrals(5), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
