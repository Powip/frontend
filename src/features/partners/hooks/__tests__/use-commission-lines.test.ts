/**
 * Tests: useCommissionLines
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data con las líneas devueltas por el service al resolver.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCommissionLines } from "../use-commission-lines";
import { getCommissionLines } from "../../services/get-commission-lines";
import type { CommissionLine } from "../../models/commission-line";

jest.mock("../../services/get-commission-lines", () => ({
  getCommissionLines: jest.fn(),
}));

const mockGetCommissionLines = jest.mocked(getCommissionLines);

const MOCK_LINE: CommissionLine = {
  id: "cl-1",
  businessName: "Negocio Uno",
  planName: "Standard",
  netFirstMonthAmount: 170.1,
  firstMonthCommission: 68.04,
  recurringCommission: 11.34,
  status: "activa",
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCommissionLines", () => {
  beforeEach(() => {
    mockGetCommissionLines.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetCommissionLines.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCommissionLines(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetCommissionLines.mockResolvedValue([MOCK_LINE]);
    const { result } = renderHook(() => useCommissionLines(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_LINE]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetCommissionLines.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useCommissionLines(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
