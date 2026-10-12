import axios from "axios";
import { getAdvertisingBusinessMetrics } from "../advertisingBusinessMetricsService";
import {
  applyAdvertisingSuggestedAssignments,
  changeAdvertisingAccountStore,
  changeAdvertisingAdsetStore,
  getAdvertisingAssignmentHistoryV11,
  getAdvertisingAssignmentsV11,
  getAdvertisingSummaryV11,
} from "../advertisingV11Service";

jest.mock("axios");
const integrations = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
const ventas = process.env.NEXT_PUBLIC_API_VENTAS;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.example.test/api/v1";
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.example.test";
});
afterAll(() => {
  if (integrations === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = integrations;
  if (ventas === undefined) delete process.env.NEXT_PUBLIC_API_VENTAS;
  else process.env.NEXT_PUBLIC_API_VENTAS = ventas;
});
const root = "https://integrations.example.test/api/v1/advertising/companies/company/workspace";
it("consulta con empresa, actor autorizado, periodo y AbortSignal sin convertir importes", async () => {
  const wire = { currencies: [{ currency: "PEN", spend: "9007199254740991.00000001" }] };
  jest.mocked(axios.get).mockResolvedValue({ data: wire });
  const signal = new AbortController().signal;
  await expect(
    getAdvertisingSummaryV11(
      "token",
      "company",
      { from: "2026-10-01", to: "2026-10-03", storeId: "none", seriesBy: "objective" },
      signal,
    ),
  ).resolves.toBe(wire);
  expect(axios.get).toHaveBeenCalledWith(
    `${root}/summary`,
    expect.objectContaining({
      signal,
      headers: { Authorization: "Bearer token" },
      params: { from: "2026-10-01", to: "2026-10-03", storeId: "none", seriesBy: "objective" },
    }),
  );
  await getAdvertisingAssignmentsV11("token", "company", "2026-09-13", "2026-10-12", signal);
  expect(axios.get).toHaveBeenLastCalledWith(
    `${root}/assignments`,
    expect.objectContaining({ params: { from: "2026-09-13", to: "2026-10-12" } }),
  );
});
it("mantiene CAS y revisión explícita al cambiar cuenta, conjunto y sugerencias", async () => {
  jest.mocked(axios.patch).mockResolvedValue({ data: { version: 3 } });
  jest.mocked(axios.post).mockResolvedValue({ data: { version: 3 } });
  const payload = {
    mode: "multi" as const,
    storeId: null,
    apply: "all_history" as const,
    expectedVersion: 2,
    reason: "Tiendas confirmadas",
  };
  await changeAdvertisingAccountStore("token", "company", "account", payload);
  expect(axios.patch).toHaveBeenLastCalledWith(
    `${root}/accounts/account/tienda`,
    payload,
    expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
  );
  const adset = {
    accountId: "account",
    storeId: "store",
    apply: "from_today" as const,
    expectedVersion: 8,
    reason: "Nuevo destino",
  };
  await changeAdvertisingAdsetStore("token", "company", "123/456", adset);
  expect(axios.patch).toHaveBeenLastCalledWith(
    `${root}/adsets/123%2F456/tienda`,
    adset,
    expect.any(Object),
  );
  const selections = {
    apply: "all_history" as const,
    reason: "Destino revisado",
    selections: [{ accountId: "account", adsetId: "456", storeId: "store", expectedVersion: 9 }],
  };
  await applyAdvertisingSuggestedAssignments("token", "company", selections);
  expect(axios.post).toHaveBeenCalledWith(
    `${root}/assignments/apply-suggestions`,
    selections,
    expect.any(Object),
  );
});
it("consulta el historial del conjunto dentro de su cuenta", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { history: [] } });
  await getAdvertisingAssignmentHistoryV11("token", "company", "account", "123");
  expect(axios.get).toHaveBeenCalledWith(
    `${root}/assignments/history`,
    expect.objectContaining({ params: { accountId: "account", adsetId: "123" } }),
  );
});
it("no usa otro puerto ni consulta anónimamente sin configuración o sesión", async () => {
  delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  await expect(
    getAdvertisingAssignmentsV11("token", "company", "2026-10-01", "2026-10-02"),
  ).rejects.toThrow();
  expect(axios.get).not.toHaveBeenCalled();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.example.test";
  await expect(
    getAdvertisingAssignmentsV11("", "company", "2026-10-01", "2026-10-02"),
  ).rejects.toThrow(/sesión/);
  expect(axios.get).not.toHaveBeenCalled();
});
it("el negocio usa el contrato de ventas entregadas sin filtrar una plataforma", async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { source: "powip-business-metrics" } });
  await getAdvertisingBusinessMetrics("token", "company", {
    from: "2026-10-01",
    to: "2026-10-03",
    basis: "delivered",
    timeZone: "America/Lima",
    storeId: "all",
    channelId: "all",
  });
  expect(axios.get).toHaveBeenCalledWith(
    expect.stringContaining("/advertising/companies/company/business-metrics"),
    expect.objectContaining({
      params: {
        from: "2026-10-01",
        to: "2026-10-03",
        basis: "delivered",
        timeZone: "America/Lima",
        storeId: "all",
        channelId: "all",
      },
    }),
  );
});
