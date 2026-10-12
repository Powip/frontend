import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AdvertisingApiError } from "@/services/advertisingService";
import { getAdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { useAdvertisingSummaryV11 } from "../useAdvertisingV11";

jest.mock("@/services/advertisingV11Service", () => ({ getAdvertisingSummaryV11: jest.fn() }));
const filters = {
  from: "2026-10-01",
  to: "2026-10-03",
  storeId: "all",
  seriesBy: "account" as const,
};
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
beforeEach(() => jest.resetAllMocks());
it("no consulta sin actor/empresa/sesión y no pone el bearer en caché", async () => {
  const h = harness();
  const { result, rerender } = renderHook(
    (identity) => useAdvertisingSummaryV11(identity, filters),
    {
      wrapper: h.wrapper,
      initialProps: { actorId: "actor", companyId: "company", token: null as string | null },
    },
  );
  expect(getAdvertisingSummaryV11).not.toHaveBeenCalled();
  jest
    .mocked(getAdvertisingSummaryV11)
    .mockResolvedValue({ from: filters.from } as Awaited<
      ReturnType<typeof getAdvertisingSummaryV11>
    >);
  rerender({ actorId: "actor", companyId: "company", token: "private-fixture-token" });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(
    JSON.stringify(
      h.client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ),
  ).not.toContain("private-fixture-token");
  expect(getAdvertisingSummaryV11).toHaveBeenCalledWith(
    "private-fixture-token",
    "company",
    filters,
    expect.any(AbortSignal),
  );
});
it("revalida el token y oculta el resultado retenido si se revoca lectura", async () => {
  const h = harness();
  jest
    .mocked(getAdvertisingSummaryV11)
    .mockResolvedValueOnce({ from: filters.from } as Awaited<
      ReturnType<typeof getAdvertisingSummaryV11>
    >)
    .mockRejectedValueOnce(new AdvertisingApiError("Sin permiso", 403));
  const { result, rerender } = renderHook(
    (identity) => useAdvertisingSummaryV11(identity, filters),
    {
      wrapper: h.wrapper,
      initialProps: { actorId: "actor", companyId: "company", token: "token-1" },
    },
  );
  await waitFor(() => expect(result.current.data).toBeDefined());
  rerender({ actorId: "actor", companyId: "company", token: "token-2" });
  await waitFor(() => expect(result.current.isAccessDenied).toBe(true));
  expect(result.current.data).toBeUndefined();
});
it("no muestra el snapshot de otro actor mientras cambia empresa", async () => {
  const h = harness();
  jest
    .mocked(getAdvertisingSummaryV11)
    .mockResolvedValueOnce({ from: filters.from } as Awaited<
      ReturnType<typeof getAdvertisingSummaryV11>
    >)
    .mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(
    (identity) => useAdvertisingSummaryV11(identity, filters),
    {
      wrapper: h.wrapper,
      initialProps: { actorId: "actor-1", companyId: "company-1", token: "token-1" },
    },
  );
  await waitFor(() => expect(result.current.data).toBeDefined());
  rerender({ actorId: "actor-2", companyId: "company-2", token: "token-2" });
  expect(result.current.data).toBeUndefined();
});
