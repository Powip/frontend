/**
 * Tests: usePartnerLink
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data cuando el service resuelve.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePartnerLink } from "../use-partner-link";
import { getPartnerLink } from "../../services/get-partner-link";
import type { PartnerLink } from "../../models/partner-link";

jest.mock("../../services/get-partner-link", () => ({
  getPartnerLink: jest.fn(),
}));

const mockGetPartnerLink = jest.mocked(getPartnerLink);

const MOCK_LINK: PartnerLink = {
  url: "powip.com/r/joel-coila",
  code: "JOEL10",
  discountPct: 10,
  clicks: 312,
  codeUses: 47,
  conversions: 7,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePartnerLink", () => {
  beforeEach(() => {
    mockGetPartnerLink.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPartnerLink.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePartnerLink(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPartnerLink.mockResolvedValue(MOCK_LINK);
    const { result } = renderHook(() => usePartnerLink(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_LINK);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPartnerLink.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePartnerLink(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
