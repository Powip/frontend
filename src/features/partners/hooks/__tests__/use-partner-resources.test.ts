/**
 * Tests: usePartnerResources
 *
 * Comportamiento verificado:
 * 1. Empieza en isLoading antes de que resuelva el service.
 * 2. Expone data cuando el service resuelve.
 * 3. Expone isError cuando el service rechaza.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePartnerResources } from "../use-partner-resources";
import { getPartnerResources } from "../../services/get-partner-resources";
import type { PartnerResource } from "../../models/partner-resource";

jest.mock("../../services/get-partner-resources", () => ({
  getPartnerResources: jest.fn(),
}));

const mockGetPartnerResources = jest.mocked(getPartnerResources);

const MOCK_RESOURCE: PartnerResource = {
  id: "res-1",
  title: "Logos POWIP",
  description: "PNG · SVG",
  kind: "logos",
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePartnerResources", () => {
  beforeEach(() => {
    mockGetPartnerResources.mockReset();
  });

  it("está en isLoading antes de que resuelva el service", () => {
    mockGetPartnerResources.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("expone data cuando el service resuelve", async () => {
    mockGetPartnerResources.mockResolvedValue([MOCK_RESOURCE]);
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_RESOURCE]);
  });

  it("expone isError cuando el service rechaza", async () => {
    mockGetPartnerResources.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePartnerResources(), { wrapper: buildWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
