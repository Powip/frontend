import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  changeShopifyStockMode,
  getShopifyReauthorizationStatus,
  getShopifyStockLocations,
  getShopifyStockReport,
  getShopifyStockRun,
  integrationsBaseUrl,
  listShopifyStockShops,
  requestShopifyStockRun,
} from "../shopifyStockService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const SHOP_ID = "5a0e0c1e-0000-4000-8000-0000000000a1";
const RUN_ID = "e0000000-0000-4000-8000-0000000000a1";

describe("Servicio de stock de Shopify (FEAT-24 H1-D, H1D-5)", () => {
  const initial = process.env.NEXT_PUBLIC_API_INTEGRATIONS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://int.powip.test";
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { ok: true } });
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { runId: RUN_ID } });
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data: { changed: true } });
  });

  afterAll(() => {
    if (initial === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
    else process.env.NEXT_PUBLIC_API_INTEGRATIONS = initial;
  });

  it("usa la fachada con JWT y nunca manda un companyId", async () => {
    await listShopifyStockShops();
    await getShopifyStockReport(SHOP_ID);
    await getShopifyStockLocations(SHOP_ID);
    await getShopifyStockRun(RUN_ID);
    await requestShopifyStockRun(SHOP_ID);
    await changeShopifyStockMode(SHOP_ID, { mode: "powip", confirm: true, acknowledgeZeroDeny: true });

    expect(jest.mocked(axiosAuth.get).mock.calls).toEqual([
      ["https://int.powip.test/shopify/stock/shops"],
      [`https://int.powip.test/shopify/stock/shops/${SHOP_ID}/report`, { params: { limit: 50 } }],
      [`https://int.powip.test/shopify/stock/shops/${SHOP_ID}/locations`],
      [`https://int.powip.test/shopify/stock/runs/${RUN_ID}`],
    ]);
    expect(axiosAuth.post).toHaveBeenCalledWith(`https://int.powip.test/shopify/stock/shops/${SHOP_ID}/runs`);
    expect(axiosAuth.patch).toHaveBeenCalledWith(`https://int.powip.test/shopify/stock/shops/${SHOP_ID}/mode`, {
      mode: "powip",
      confirm: true,
      acknowledgeZeroDeny: true,
    });
    expect(JSON.stringify([...jest.mocked(axiosAuth.get).mock.calls, ...jest.mocked(axiosAuth.patch).mock.calls])).not.toContain(
      "companyId",
    );
  });

  it("estado de re-autorización: refresh solo cuando se pide", async () => {
    await getShopifyReauthorizationStatus();
    await getShopifyReauthorizationStatus(true);
    expect(jest.mocked(axiosAuth.get).mock.calls).toEqual([
      ["https://int.powip.test/shopify/reauthorization-status", { params: undefined }],
      ["https://int.powip.test/shopify/reauthorization-status", { params: { refresh: true } }],
    ]);
  });

  it("sin NEXT_PUBLIC_API_INTEGRATIONS va por el gateway", async () => {
    delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
    await listShopifyStockShops();
    expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.integrations}/shopify/stock/shops`);
    expect(integrationsBaseUrl()).toBe(GATEWAY.integrations);
  });

  it("devuelve el cuerpo de la respuesta", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValueOnce({ data: { generatedAt: "x", shops: [] } });
    await expect(listShopifyStockShops()).resolves.toEqual({ generatedAt: "x", shops: [] });
  });
});
