/**
 * Tests: usePayoutSettings
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data con los datos de cobro devueltos por el service.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePayoutSettings } from "../use-payout-settings";
import { getPayoutSettings } from "../../services/get-payout-settings";
import type { PayoutSettings } from "../../models/payout-settings";

jest.mock("../../services/get-payout-settings", () => ({
  getPayoutSettings: jest.fn(),
}));

const mockGetPayoutSettings = jest.mocked(getPayoutSettings);

const MOCK_SETTINGS: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  minimumThreshold: 50,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePayoutSettings", () => {
  beforeEach(() => {
    mockGetPayoutSettings.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPayoutSettings.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePayoutSettings(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPayoutSettings.mockResolvedValue(MOCK_SETTINGS);
    const { result } = renderHook(() => usePayoutSettings(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_SETTINGS);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPayoutSettings.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePayoutSettings(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
