/**
 * Tests: usePayoutHistory
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data con las entradas devueltas por el service.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePayoutHistory } from "../use-payout-history";
import { getPayoutHistory } from "../../services/get-payout-history";
import type { PayoutHistoryEntry } from "../../models/payout-history-entry";

jest.mock("../../services/get-payout-history", () => ({
  getPayoutHistory: jest.fn(),
}));

const mockGetPayoutHistory = jest.mocked(getPayoutHistory);

const MOCK_ENTRY: PayoutHistoryEntry = {
  id: "payout-1",
  date: "2026-08-25",
  concept: "1er mes",
  amount: 95.52,
  status: "programado",
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePayoutHistory", () => {
  beforeEach(() => {
    mockGetPayoutHistory.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPayoutHistory.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePayoutHistory(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPayoutHistory.mockResolvedValue([MOCK_ENTRY]);
    const { result } = renderHook(() => usePayoutHistory(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_ENTRY]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPayoutHistory.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePayoutHistory(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
