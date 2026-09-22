/**
 * Tests: useReferrals
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data con los referidos devueltos por el service al resolver.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useReferrals } from "../use-referrals";
import { getReferrals } from "../../services/get-referrals";
import type { PartnerReferral } from "../../models/partner-referral";

jest.mock("../../services/get-referrals", () => ({
  getReferrals: jest.fn(),
}));

const mockGetReferrals = jest.mocked(getReferrals);

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

describe("useReferrals", () => {
  beforeEach(() => {
    mockGetReferrals.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetReferrals.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetReferrals.mockResolvedValue([MOCK_REFERRAL]);
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_REFERRAL]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetReferrals.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useReferrals(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
