/**
 * Tests: «Stock de Shopify» en Tiendas y almacenes (FEAT-24 H1-D, H1D-5).
 *
 * 1. Sin tiendas de Shopify no muestra nada.
 * 2. Cada tienda muestra su modo («Shopify manda» / «Solo reporte» / «Powip manda»),
 *    su tienda y almacén de Powip y los contadores del último reporte.
 * 3. Si falta re-autorizar: aviso con motivos y, para un admin, «Volver a autorizar
 *    en Shopify» pide la URL con la sesión (`POST /shopify/auth-url`, FEAT-24 SEC) y
 *    navega solo si es la pantalla de permisos de esa tienda; si no, avisa.
 * 4. Un usuario que no es admin ve el estado y el reporte, pero no «Generar
 *    reporte» ni «Cambiar modo».
 * 5. «Generar reporte» pide la corrida, la sigue hasta que termina y refresca;
 *    un 409 con la corrida de la tienda sigue esa; uno sin corrida avisa.
 * 6. En «Shopify manda» no se ofrece generar reporte (hay que pasar a «Solo reporte»).
 * 7. «Ver reporte» abre el último reporte con sus listas.
 * 8. Una corrida que ya estaba en curso al cargar se sigue sin avisos.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { goToExternalPage } from "@/lib/browserNavigation";
import {
  getShopifyReauthorizationStatus,
  requestShopifyAuthUrl,
  getShopifyStockReport,
  getShopifyStockRun,
  listShopifyStockShops,
  requestShopifyStockRun,
  type ShopifyStockCounters,
  type ShopifyStockReport,
  type ShopifyStockRun,
  type ShopifyStockShop,
} from "@/services/shopifyStockService";
import { listWarehouses } from "@/services/warehousesService";
import ShopifyStockSection from "../ShopifyStockSection";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/shopifyStockService", () => ({
  listShopifyStockShops: jest.fn(),
  getShopifyReauthorizationStatus: jest.fn(),
  getShopifyStockReport: jest.fn(),
  getShopifyStockLocations: jest.fn(),
  getShopifyStockRun: jest.fn(),
  requestShopifyStockRun: jest.fn(),
  changeShopifyStockMode: jest.fn(),
  requestShopifyAuthUrl: jest.fn(),
}));
jest.mock("@/lib/browserNavigation", () => ({ goToExternalPage: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const mockShops = jest.mocked(listShopifyStockShops);
const mockReauth = jest.mocked(getShopifyReauthorizationStatus);
const mockReport = jest.mocked(getShopifyStockReport);
const mockRun = jest.mocked(getShopifyStockRun);
const mockRequest = jest.mocked(requestShopifyStockRun);
const mockAuthUrl = jest.mocked(requestShopifyAuthUrl);
const mockGoTo = jest.mocked(goToExternalPage);

const COMPANY = "company-a";
const counters = (over: Partial<ShopifyStockCounters> = {}): ShopifyStockCounters => ({
  seen: 100,
  linked: 90,
  skipped_unlinked: 6,
  skipped_sku_only: 0,
  skipped_duplicate: 0,
  skipped_untracked: 4,
  to_publish: 12,
  published: 0,
  skipped_changed: 0,
  errors: 0,
  tracked_deny_count: 3,
  locations_count: 1,
  pending_orders_imported: 0,
  skipped_not_in_warehouse: 0,
  skipped_not_stocked: 0,
  skipped_out_of_range: 0,
  unchanged: 78,
  would_zero: 5,
  would_zero_deny: 2,
  skipped_sku_mismatch: 1,
  multi_location_diff: 0,
  ...over,
});
const run = (over: Partial<ShopifyStockRun> = {}): ShopifyStockRun => ({
  id: "run-1",
  mode: "reporte",
  status: "ok",
  startedAt: "2026-11-17T08:00:00.000Z",
  finishedAt: "2026-11-17T08:01:00.000Z",
  error: null,
  stockLocationId: "gid://shopify/Location/111",
  inventoryId: "inv-1",
  writeBlockedReason: null,
  counters: counters(),
  ...over,
});
const shop = (over: Partial<ShopifyStockShop> & Pick<ShopifyStockShop, "id" | "shopUrl">): ShopifyStockShop => ({
  storeId: "store-a",
  inventoryId: "inv-1",
  stockMode: "reporte",
  stockLocationId: "gid://shopify/Location/111",
  isActive: true,
  healthStatus: "ok",
  needsReauthorization: false,
  stockPublishError: null,
  stockPublishErrorAt: null,
  stockAckOnlineLocations: null,
  lastRun: run(),
  runningRun: null,
  ...over,
});

const REPORTE = shop({ id: "shop-1", shopUrl: "uno.myshopify.com" });
const SHOPIFY = shop({ id: "shop-2", shopUrl: "dos.myshopify.com", stockMode: "shopify", lastRun: null, storeId: "store-b" });

const setAuth = (role = "ADMINISTRADOR") =>
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "tok",
      user: { id: "u1", email: "u@x.test", role },
      company: {
        id: COMPANY,
        stores: [
          { id: "store-a", name: "Tienda Centro" },
          { id: "store-b", name: "Tienda Sur" },
        ],
      },
    },
  } as unknown as ReturnType<typeof useAuth>);

const renderSection = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShopifyStockSection />
    </QueryClientProvider>,
  );
};

const card = (id: string) => screen.findByTestId(`shopify-stock-${id}`);

beforeEach(() => {
  jest.clearAllMocks();
  setAuth();
  mockShops.mockResolvedValue({ generatedAt: "x", shops: [REPORTE, SHOPIFY] });
  mockReauth.mockResolvedValue({ generatedAt: "x", requiredScopes: [], shops: [] });
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [{ id: "inv-1", name: "Almacén Central", status: true, store_id: "store-a", company_id: COMPANY, type: "PROPIO", is_main: true }],
    links: [],
  });
});

it("sin tiendas de Shopify no muestra nada", async () => {
  mockShops.mockResolvedValue({ generatedAt: "x", shops: [] });
  const { container } = renderSection();
  await waitFor(() => expect(mockShops).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it("muestra el modo, la tienda, el almacén y los contadores del último reporte", async () => {
  renderSection();
  const uno = await card("shop-1");
  expect(within(uno).getByRole("heading", { name: "uno.myshopify.com" })).toBeInTheDocument();
  expect(within(uno).getAllByText("Solo reporte")[0]).toBeInTheDocument();
  expect(await within(uno).findByText(/Almacén: Almacén Central/)).toBeInTheDocument();
  expect(within(uno).getByText(/Tienda: Tienda Centro/)).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-iguales")).getByText("78")).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-a_publicar")).getByText("12")).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-quedarian_en_0")).getByText("5")).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-frenan_venta")).getByText("2")).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-sku_no_cruzan")).getByText("1")).toBeInTheDocument();
  expect(within(within(uno).getByTestId("counter-sin_vincular")).getByText("6")).toBeInTheDocument();

  const dos = await card("shop-2");
  expect(within(dos).getAllByText("Shopify manda")[0]).toBeInTheDocument();
  expect(within(dos).getByText("Todavía no hay reportes de esta tienda.")).toBeInTheDocument();
});

const reauthNeeded = () =>
  mockReauth.mockResolvedValue({
    generatedAt: "x",
    requiredScopes: ["read_inventory"],
    shops: [
      {
        shopId: "shop-1",
        shopUrl: "uno.myshopify.com",
        storeId: "store-a",
        isActive: true,
        healthStatus: "ok",
        tokenHealthy: true,
        grantedScopes: ["read_orders"],
        missingScopes: ["read_inventory"],
        scopesCheckedAt: null,
        scopesSource: "access_scopes",
        scopesError: null,
        needsReauthorization: true,
        reasons: ["faltan_scopes"],
      },
    ],
  });

it("avisa que hay que volver a autorizar, con el botón para un admin", async () => {
  mockReauth.mockResolvedValue({
    generatedAt: "x",
    requiredScopes: ["read_inventory", "write_inventory", "read_locations"],
    shops: [
      {
        shopId: "shop-1",
        shopUrl: "uno.myshopify.com",
        storeId: "store-a",
        isActive: true,
        healthStatus: "ok",
        tokenHealthy: true,
        grantedScopes: ["read_orders"],
        missingScopes: ["read_inventory", "write_inventory"],
        scopesCheckedAt: null,
        scopesSource: "access_scopes",
        scopesError: null,
        needsReauthorization: true,
        reasons: ["faltan_scopes"],
        reauthorizeUrl: "/shopify/reauth/uno.myshopify.com",
      },
    ],
  });
  renderSection();
  const uno = await card("shop-1");
  expect(await within(uno).findByText("Hay que volver a autorizar la app de Powip en Shopify")).toBeInTheDocument();
  expect(within(uno).getByText(/Faltan permisos de inventario: leer el inventario, escribir el inventario/)).toBeInTheDocument();
  // FEAT-24 SEC: ya no es un enlace a /shopify/reauth (sin sesión), sino un botón que pide la URL con el token.
  expect(within(uno).getByRole("button", { name: "Volver a autorizar en Shopify" })).toBeEnabled();
  expect(within(uno).queryByRole("link", { name: /volver a autorizar/i })).not.toBeInTheDocument();
  // La otra tienda no tiene aviso.
  expect(within(await card("shop-2")).queryByText(/volver a autorizar/i)).not.toBeInTheDocument();
});

it("un usuario que no es admin ve el estado y el reporte, sin generar ni cambiar el modo", async () => {
  setAuth("VENDEDOR");
  mockReauth.mockResolvedValue({
    generatedAt: "x",
    requiredScopes: [],
    shops: [
      {
        shopId: "shop-1",
        shopUrl: "uno.myshopify.com",
        storeId: null,
        isActive: true,
        healthStatus: "token_revocado",
        tokenHealthy: false,
        grantedScopes: null,
        missingScopes: null,
        scopesCheckedAt: null,
        scopesSource: null,
        scopesError: null,
        needsReauthorization: true,
        reasons: ["token_revocado"],
        reauthorizeUrl: "https://int.powip.test/shopify/reauth/uno.myshopify.com",
      },
    ],
  });
  renderSection();
  const uno = await card("shop-1");
  expect(await within(uno).findByText("Un administrador de la empresa tiene que volver a autorizarla.")).toBeInTheDocument();
  expect(within(uno).queryByRole("button", { name: /volver a autorizar/i })).not.toBeInTheDocument();
  expect(within(uno).getByRole("button", { name: "Ver reporte" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Generar reporte/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cambiar modo" })).not.toBeInTheDocument();
});

it("«Volver a autorizar» pide la URL con la sesión y va a la pantalla de permisos de esa tienda (FEAT-24 SEC)", async () => {
  const user = userEvent.setup();
  reauthNeeded();
  const url = "https://uno.myshopify.com/admin/oauth/authorize?client_id=x&state=v1.a.b";
  mockAuthUrl.mockResolvedValue(url);
  renderSection();
  const uno = await card("shop-1");

  await user.click(await within(uno).findByRole("button", { name: "Volver a autorizar en Shopify" }));

  await waitFor(() => expect(mockGoTo).toHaveBeenCalledWith(url));
  expect(mockAuthUrl).toHaveBeenCalledWith("uno.myshopify.com");
  expect(toast.error).not.toHaveBeenCalled();
});

it("«Volver a autorizar»: si la URL no es la de esa tienda no navega; un 403 muestra el motivo del backend", async () => {
  const user = userEvent.setup();
  reauthNeeded();
  mockAuthUrl.mockResolvedValueOnce("https://evil.example/admin/oauth/authorize?x=1");
  mockAuthUrl.mockRejectedValueOnce({
    response: { status: 403, data: { message: "Esta tienda de Shopify ya está vinculada a otra empresa de Powip." } },
  });
  renderSection();
  const uno = await card("shop-1");
  const button = await within(uno).findByRole("button", { name: "Volver a autorizar en Shopify" });

  await user.click(button);
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("No se pudo abrir la autorización de Shopify. Inténtalo de nuevo."),
  );
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Esta tienda de Shopify ya está vinculada a otra empresa de Powip."),
  );
  expect(mockGoTo).not.toHaveBeenCalled();
});

it("«Generar reporte» pide la corrida, la sigue hasta el final y refresca las tiendas", async () => {
  const user = userEvent.setup();
  mockRequest.mockResolvedValue({ shopId: "shop-1", shopUrl: "uno.myshopify.com", runId: "run-2", status: "running", startedAt: null, dryRun: true });
  mockRun.mockResolvedValue({ shopId: "shop-1", run: run({ id: "run-2", status: "ok" }) });
  renderSection();
  const uno = await card("shop-1");
  const callsBefore = mockShops.mock.calls.length;

  await user.click(within(uno).getByRole("button", { name: /Generar reporte/ }));

  expect(mockRequest).toHaveBeenCalledWith("shop-1");
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("El reporte está listo."));
  expect(mockRun).toHaveBeenCalledWith("run-2");
  await waitFor(() => expect(mockShops.mock.calls.length).toBeGreaterThan(callsBefore));
});

it("una corrida que termina con error avisa el motivo", async () => {
  const user = userEvent.setup();
  mockRequest.mockResolvedValue({ shopId: "shop-1", shopUrl: "uno.myshopify.com", runId: "run-2", status: "running", startedAt: null, dryRun: true });
  mockRun.mockResolvedValue({ shopId: "shop-1", run: run({ id: "run-2", status: "error", error: "Shopify respondió 401" }) });
  renderSection();
  await user.click(within(await card("shop-1")).getByRole("button", { name: /Generar reporte/ }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El reporte terminó: con error. Shopify respondió 401"));
});

it("un 409 con la corrida en curso de la tienda sigue esa; uno sin corrida avisa que espere", async () => {
  const user = userEvent.setup();
  mockRequest.mockRejectedValueOnce({ response: { status: 409, data: { runningRunId: "run-0" } } });
  mockRun.mockResolvedValue({ shopId: "shop-1", run: run({ id: "run-0", status: "ok" }) });
  renderSection();
  const uno = await card("shop-1");

  await user.click(within(uno).getByRole("button", { name: /Generar reporte/ }));
  expect(toast.info).toHaveBeenCalledWith("Ya hay un reporte en curso para esta tienda: se muestra ese.");
  await waitFor(() => expect(mockRun).toHaveBeenCalledWith("run-0"));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("El reporte está listo."));

  mockRequest.mockRejectedValueOnce({ response: { status: 409, data: { message: "La republicación diaria está en curso" } } });
  await waitFor(() => expect(within(uno).getByRole("button", { name: /Generar reporte/ })).toBeEnabled());
  await user.click(within(uno).getByRole("button", { name: /Generar reporte/ }));
  expect(toast.error).toHaveBeenCalledWith("Ya hay una actualización de stock en curso. Vuelve a intentarlo en unos minutos.");
});

it("en «Shopify manda» no se ofrece generar reporte", async () => {
  renderSection();
  const dos = await card("shop-2");
  expect(within(dos).queryByRole("button", { name: /Generar reporte/ })).not.toBeInTheDocument();
  expect(within(dos).getByText("Para generar un reporte, pasa la tienda a «Solo reporte».")).toBeInTheDocument();
  expect(within(dos).getByRole("button", { name: "Cambiar modo" })).toBeInTheDocument();
});

it("«Ver reporte» abre el último reporte con sus listas", async () => {
  const user = userEvent.setup();
  const deny = {
    shopifyVariantId: "v-deny",
    shopifyInventoryItemId: null,
    shopifySku: "POLO-ROJO-M",
    powipSku: "POLO-ROJO-M",
    powipVariantId: "pv-1",
    signal: "external_id",
    confidence: 1,
    tracked: true,
    inventoryPolicy: "deny",
    shopifyAvailable: 4,
    shopifyAvailableTotal: null,
    powipAvailable: 0,
    detail: null,
  };
  const report: ShopifyStockReport = {
    generatedAt: "x",
    shop: {
      id: "shop-1",
      shopUrl: "uno.myshopify.com",
      stockMode: "reporte",
      stockLocationId: null,
      stockPublishError: null,
      stockPublishErrorAt: null,
      isActive: true,
      healthStatus: "ok",
      needsReauthorization: false,
      hasInventory: true,
      stockAckOnlineLocations: null,
    },
    run: run(),
    locationsCount: 1,
    trackedDenyCount: 3,
    itemsLimit: 50,
    groups: [
      { action: "publish", total: 12, items: [deny] },
      { action: "skip_sku_mismatch", total: 1, items: [{ ...deny, shopifyVariantId: "v-sku", shopifySku: "OTRO", powipSku: "POLO" }] },
    ],
    multiLocation: { total: 0, items: [] },
    wouldZeroDeny: { total: 2, items: [deny] },
  };
  mockReport.mockResolvedValue(report);
  renderSection();
  await user.click(within(await card("shop-1")).getByRole("button", { name: "Ver reporte" }));

  const dialog = await screen.findByRole("dialog");
  expect(mockReport).toHaveBeenCalledWith("shop-1", 50);
  expect(await within(dialog).findByRole("button", { name: "A publicar (12)" })).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).getByText("Se muestran 1 de 12.")).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: "Frenan la venta (2)" }));
  const list = within(dialog).getByRole("region", { name: "Frenan la venta" });
  expect(within(list).getAllByText("POLO-ROJO-M")).toHaveLength(2);

  await user.click(within(dialog).getByRole("button", { name: "SKU que no cruzan (1)" }));
  expect(within(within(dialog).getByRole("region", { name: "SKU que no cruzan" })).getByText("OTRO")).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: "Varias ubicaciones (0)" }));
  expect(within(dialog).getByText("No hay variantes en esta lista.")).toBeInTheDocument();
});

it("una corrida que ya estaba en curso se sigue sin avisos y refresca al terminar", async () => {
  mockShops.mockResolvedValueOnce({
    generatedAt: "x",
    shops: [{ ...REPORTE, runningRun: { id: "run-9", startedAt: "2026-11-17T09:00:00.000Z" } }, SHOPIFY],
  });
  mockRun.mockResolvedValue({ shopId: "shop-1", run: run({ id: "run-9", status: "ok" }) });
  renderSection();
  await card("shop-1");
  await waitFor(() => expect(mockRun).toHaveBeenCalledWith("run-9"));
  await waitFor(() => expect(mockShops.mock.calls.length).toBeGreaterThan(1));
  expect(toast.success).not.toHaveBeenCalled();
});
