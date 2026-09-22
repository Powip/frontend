/**
 * Tests: usePartnerSummary
 *
 * Comportamiento verificado:
 * 1. Empieza en estado de carga (isLoading) antes de que resuelva el service.
 * 2. Al resolver el service, expone `data` con el PartnerSummary devuelto.
 * 3. Si el service rechaza, expone `isError` true y `data` undefined.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePartnerSummary } from "../use-partner-summary";
import { getPartnerSummary } from "../../services/get-partner-summary";
import type { PartnerSummary } from "../../models/partner-summary";

jest.mock("../../services/get-partner-summary", () => ({
  getPartnerSummary: jest.fn(),
}));

const mockGetPartnerSummary = jest.mocked(getPartnerSummary);

const MOCK_SUMMARY: PartnerSummary = {
  tier: { level: "bronce", activeMrr: 0, nextLevelThreshold: 500, extraResidualPct: 0 },
  commissionOption: { code: "A", firstMonthPct: 40, recurringPct: 6 },
  recurringActiveMonthly: 0,
  firstMonthCommissionThisMonth: 0,
  pendingCommission: 0,
  totalPaidToDate: 0,
  reversals: 0,
  funnel: [],
  nextPayout: { amount: 0, payoutDate: "2026-08-25", breakdown: [] },
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePartnerSummary", () => {
  beforeEach(() => {
    mockGetPartnerSummary.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPartnerSummary.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePartnerSummary(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPartnerSummary.mockResolvedValue(MOCK_SUMMARY);
    const { result } = renderHook(() => usePartnerSummary(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_SUMMARY);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPartnerSummary.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePartnerSummary(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
