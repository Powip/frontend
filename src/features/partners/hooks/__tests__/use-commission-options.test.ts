/**
 * Tests: useCommissionOptions
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data cuando el service resuelve.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCommissionOptions } from "../use-commission-options";
import { getCommissionOptions } from "../../services/get-commission-options";
import type { CommissionOptionDetail } from "../../models/commission-option-detail";

jest.mock("../../services/get-commission-options", () => ({
  getCommissionOptions: jest.fn(),
}));

const mockGetCommissionOptions = jest.mocked(getCommissionOptions);

const MOCK_OPTION: CommissionOptionDetail = {
  code: "A",
  label: "Agencias y developers",
  description: "desc",
  firstMonthPct: 40,
  recurringPct: 6,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCommissionOptions", () => {
  beforeEach(() => {
    mockGetCommissionOptions.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetCommissionOptions.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCommissionOptions(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetCommissionOptions.mockResolvedValue([MOCK_OPTION]);
    const { result } = renderHook(() => useCommissionOptions(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_OPTION]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetCommissionOptions.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useCommissionOptions(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
