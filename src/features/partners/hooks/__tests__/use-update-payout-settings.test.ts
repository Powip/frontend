/**
 * Tests: useUpdatePayoutSettings
 *
 * Comportamiento verificado:
 * 1. Al mutar con éxito, escribe el resultado en la cache de payoutSettings (sin refetch).
 * 2. Al mutar con éxito, muestra un toast de éxito.
 * 3. Si el service rechaza, expone isError y muestra un toast de error.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useUpdatePayoutSettings } from "../use-update-payout-settings";
import { updatePayoutSettings } from "../../services/update-payout-settings";
import { partnersKeys } from "../../keys/partners.keys";
import type { PayoutSettings } from "../../models/payout-settings";

jest.mock("../../services/update-payout-settings", () => ({
  updatePayoutSettings: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockUpdatePayoutSettings = jest.mocked(updatePayoutSettings);

const UPDATED_SETTINGS: PayoutSettings = {
  method: "plin",
  accountNumber: "999 111 222",
  accountHolder: "Joel Coila",
  minimumThreshold: 50,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

describe("useUpdatePayoutSettings", () => {
  beforeEach(() => {
    mockUpdatePayoutSettings.mockReset();
    jest.mocked(toast.success).mockReset();
    jest.mocked(toast.error).mockReset();
  });

  it("escribe el resultado en la cache de payoutSettings al mutar con éxito", async () => {
    mockUpdatePayoutSettings.mockResolvedValue(UPDATED_SETTINGS);
    const { wrapper, queryClient } = buildWrapper();
    const { result } = renderHook(() => useUpdatePayoutSettings(), { wrapper });

    result.current.mutate({ method: "plin", accountNumber: "999 111 222" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(partnersKeys.payoutSettings())).toEqual(UPDATED_SETTINGS);
  });

  it("muestra un toast de éxito", async () => {
    mockUpdatePayoutSettings.mockResolvedValue(UPDATED_SETTINGS);
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpdatePayoutSettings(), { wrapper });

    result.current.mutate({ method: "plin", accountNumber: "999 111 222" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalled();
  });

  it("muestra un toast de error cuando el service rechaza", async () => {
    mockUpdatePayoutSettings.mockRejectedValue(new Error("network error"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpdatePayoutSettings(), { wrapper });

    result.current.mutate({ method: "plin", accountNumber: "999 111 222" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
