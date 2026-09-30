import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { partnersKeys } from "../../keys/partners.keys";
import { getPartnerIdentity } from "../../services/get-partner-identity";
import { buildAxiosError } from "../../test-utils/axios-error";
import { shouldRetryPartnerIdentity, usePartnerIdentity } from "../use-partner-identity";

jest.mock("../../services/get-partner-identity", () => ({
  getPartnerIdentity: jest.fn(),
}));

const mockGetPartnerIdentity = jest.mocked(getPartnerIdentity);

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildClient() {
  return new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
}

describe("usePartnerIdentity", () => {
  beforeEach(() => {
    mockGetPartnerIdentity.mockReset();
  });

  it("está en isPending mientras /me no responde", () => {
    mockGetPartnerIdentity.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePartnerIdentity(), {
      wrapper: buildWrapper(buildClient()),
    });

    expect(result.current.isPending).toBe(true);
  });

  it("expone la identidad resuelta y la guarda bajo partnersKeys.me()", async () => {
    mockGetPartnerIdentity.mockResolvedValue({ kind: "not_partner" });
    const queryClient = buildClient();
    const { result } = renderHook(() => usePartnerIdentity(), {
      wrapper: buildWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "not_partner" });
    expect(queryClient.getQueryData(partnersKeys.me())).toEqual({ kind: "not_partner" });
  });

  it("no reintenta un 401", async () => {
    mockGetPartnerIdentity.mockRejectedValue(buildAxiosError(401));
    const { result } = renderHook(() => usePartnerIdentity(), {
      wrapper: buildWrapper(buildClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetPartnerIdentity).toHaveBeenCalledTimes(1);
  });

  it("reintenta una vez un error de red antes de exponer isError", async () => {
    mockGetPartnerIdentity.mockRejectedValue(buildAxiosError());
    const { result } = renderHook(() => usePartnerIdentity(), {
      wrapper: buildWrapper(buildClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetPartnerIdentity).toHaveBeenCalledTimes(2);
  });
});

describe("shouldRetryPartnerIdentity", () => {
  it.each([
    ["error de red", buildAxiosError(), true],
    ["500", buildAxiosError(500), true],
    ["401", buildAxiosError(401), false],
    ["403", buildAxiosError(403), false],
    ["400", buildAxiosError(400), false],
  ])("%s en el primer fallo → reintenta: %s", (_label, error, expected) => {
    expect(shouldRetryPartnerIdentity(0, error)).toBe(expected);
  });

  it("nunca reintenta más de una vez", () => {
    expect(shouldRetryPartnerIdentity(1, buildAxiosError())).toBe(false);
  });
});
