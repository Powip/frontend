/**
 * Tests: diálogo «Cambiar el modo de stock» (FEAT-24 H1-D, H1D-5).
 *
 * 1. Desde «Solo reporte» propone «Powip manda», carga las ubicaciones, elige la
 *    guardada y no deja enviar sin la confirmación; envía `confirm` y la ubicación.
 * 2. Las casillas `acknowledgeZeroDeny` / `acknowledgeMultiLocation` aparecen solo
 *    cuando el 422 las pide, con las precondiciones legibles; al marcarlas viajan.
 * 3. Si otras tiendas comparten el almacén, ofrece pasarlas juntas (`groupShopIds`)
 *    y muestra lo que falta en cada una.
 * 4. Volver a «Shopify manda» siempre se ofrece, con el aviso, y no manda ubicación.
 * 5. Un 409 avisa y refresca; un 403 avisa.
 * 6. Pasar a «Solo reporte» manda la ubicación elegida, sin confirmación.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  changeShopifyStockMode,
  getShopifyStockLocations,
  type ShopifyStockShop,
} from "@/services/shopifyStockService";
import ShopifyStockModeDialog from "../ShopifyStockModeDialog";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/shopifyStockService", () => ({
  changeShopifyStockMode: jest.fn(),
  getShopifyStockLocations: jest.fn(),
}));

const mockChange = jest.mocked(changeShopifyStockMode);
const mockLocations = jest.mocked(getShopifyStockLocations);

const shop = (over: Partial<ShopifyStockShop> & Pick<ShopifyStockShop, "id" | "shopUrl">): ShopifyStockShop => ({
  storeId: "store-a",
  inventoryId: "inv-1",
  stockMode: "reporte",
  stockLocationId: "222",
  isActive: true,
  healthStatus: "ok",
  needsReauthorization: false,
  stockPublishError: null,
  stockPublishErrorAt: null,
  stockAckOnlineLocations: null,
  lastRun: null,
  runningRun: null,
  ...over,
});

const UNO = shop({ id: "shop-1", shopUrl: "uno.myshopify.com" });
const HERMANA = shop({ id: "shop-2", shopUrl: "hermana.myshopify.com", stockMode: "shopify" });
const OTRA = shop({ id: "shop-3", shopUrl: "otra.myshopify.com", inventoryId: "inv-9" });

const result = (over: Record<string, unknown> = {}) => ({
  shopId: "shop-1",
  shopUrl: "uno.myshopify.com",
  requestedMode: "powip",
  previousMode: "reporte",
  currentMode: "powip",
  changed: true,
  stockLocationId: "gid://shopify/Location/222",
  preconditions: [],
  unmet: [],
  warnings: [],
  locations: null,
  lastRun: null,
  ...over,
});

const http = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

const renderDialog = (target: ShopifyStockShop = UNO, shops: ShopifyStockShop[] = [UNO, OTRA]) => {
  const onOpenChange = jest.fn();
  const onChanged = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShopifyStockModeDialog shop={target} shops={shops} open onOpenChange={onOpenChange} onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return { onOpenChange, onChanged };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLocations.mockResolvedValue({
    shopId: "shop-1",
    shopUrl: "uno.myshopify.com",
    stockLocationId: "222",
    locations: [
      { id: "gid://shopify/Location/111", legacyId: "111", name: "Central", isActive: true, fulfillsOnlineOrders: true },
      { id: "gid://shopify/Location/222", legacyId: "222", name: "Depósito", isActive: true, fulfillsOnlineOrders: false },
      { id: "gid://shopify/Location/333", legacyId: "333", name: "Cerrada", isActive: false, fulfillsOnlineOrders: false },
    ],
  });
  mockChange.mockResolvedValue(result() as never);
});

it("desde «Solo reporte» propone «Powip manda», con la ubicación guardada y la confirmación obligatoria", async () => {
  const user = userEvent.setup();
  const { onOpenChange, onChanged } = renderDialog();
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByRole("radio", { name: /Powip manda/ })).toBeChecked();
  expect(within(dialog).queryByRole("radio", { name: /Solo reporte/ })).not.toBeInTheDocument();
  const select = await within(dialog).findByLabelText("Ubicación de Shopify");
  // La guardada («222») viene como número y se reconoce por su gid; la inactiva no se ofrece.
  await waitFor(() => expect(select).toHaveValue("gid://shopify/Location/222"));
  expect(within(select).queryByRole("option", { name: /Cerrada/ })).not.toBeInTheDocument();
  expect(within(select).getByRole("option", { name: "Central · despacha online" })).toBeInTheDocument();

  const submit = within(dialog).getByRole("button", { name: "Pasar a «Powip manda»" });
  expect(submit).toBeDisabled();
  // Las aceptaciones no aparecen antes de que el backend las pida.
  expect(within(dialog).queryByRole("checkbox", { name: /dejen de venderse/ })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("checkbox", { name: /una sola ubicación/ })).not.toBeInTheDocument();

  await user.click(within(dialog).getByRole("checkbox", { name: "Confirmar que Powip pase a mandar el stock" }));
  await user.click(submit);

  await waitFor(() =>
    expect(mockChange).toHaveBeenCalledWith("shop-1", {
      mode: "powip",
      stockLocationId: "gid://shopify/Location/222",
      confirm: true,
    }),
  );
  expect(toast.success).toHaveBeenCalledWith("uno.myshopify.com quedó en «Powip manda».");
  expect(onChanged).toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("un 422 muestra lo que falta y ofrece solo las aceptaciones que pide; al marcarlas viajan", async () => {
  const user = userEvent.setup();
  mockChange.mockRejectedValueOnce(
    http(422, {
      statusCode: 422,
      message: "No se puede pasar…",
      currentMode: "reporte",
      preconditions: [
        { code: "confirmacion", ok: true, message: "confirmación explícita recibida" },
        { code: "venta_bloqueada", ok: false, message: "el último reporte tiene 4 variantes con política deny…" },
        { code: "ubicaciones_online", ok: false, message: "otras ubicaciones activas despachan pedidos online: Central" },
        { code: "reporte_reciente", ok: false, message: "el último reporte terminó hace 60 h" },
      ],
      unmet: ["venta_bloqueada", "ubicaciones_online", "reporte_reciente"],
      lastRun: { counters: { would_zero_deny: 4 } },
    }),
  );
  renderDialog();
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByLabelText("Ubicación de Shopify");
  await user.click(within(dialog).getByRole("checkbox", { name: "Confirmar que Powip pase a mandar el stock" }));
  await user.click(within(dialog).getByRole("button", { name: "Pasar a «Powip manda»" }));

  const alert = await within(dialog).findByRole("alert");
  expect(within(alert).getByText("Todavía no se puede cambiar el modo: falta lo que se lista abajo.")).toBeInTheDocument();
  expect(within(alert).getByText("Hay productos que dejarían de venderse en la tienda online")).toBeInTheDocument();
  expect(within(alert).getByText("Otras ubicaciones de Shopify también despachan pedidos online")).toBeInTheDocument();
  expect(within(alert).getByText("El último reporte es viejo: hace falta uno más reciente")).toBeInTheDocument();
  expect(within(alert).getByText("el último reporte terminó hace 60 h")).toBeInTheDocument();
  expect(within(alert).queryByText("Falta confirmar el cambio")).not.toBeInTheDocument();
  expect(toast.error).not.toHaveBeenCalled();

  expect(within(dialog).getByText(/Acepto que 4 variantes con stock en Shopify queden en 0/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole("checkbox", { name: "Aceptar que haya productos que dejen de venderse" }));
  await user.click(within(dialog).getByRole("checkbox", { name: "Aceptar publicar en una sola ubicación" }));
  await user.click(within(dialog).getByRole("button", { name: "Pasar a «Powip manda»" }));

  await waitFor(() =>
    expect(mockChange).toHaveBeenLastCalledWith("shop-1", {
      mode: "powip",
      stockLocationId: "gid://shopify/Location/222",
      confirm: true,
      acknowledgeZeroDeny: true,
      acknowledgeMultiLocation: true,
    }),
  );
});

it("si otras tiendas comparten el almacén, ofrece pasarlas juntas y muestra lo que falta en cada una", async () => {
  const user = userEvent.setup();
  mockChange
    .mockRejectedValueOnce(
      http(422, {
        preconditions: [{ code: "almacen_compartido", ok: false, message: "otras tiendas activas… hermana.myshopify.com (shopify)" }],
        unmet: ["almacen_compartido"],
      }),
    )
    .mockRejectedValueOnce(
      http(422, {
        preconditions: [{ code: "ubicacion", ok: true, message: "ok" }],
        group: [{ shopUrl: "hermana.myshopify.com", preconditions: [{ code: "ultimo_reporte_ok", ok: false, message: "nunca corrió" }] }],
      }),
    );
  renderDialog(UNO, [UNO, HERMANA, OTRA]);
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByLabelText("Ubicación de Shopify");
  const group = within(dialog).getByRole("checkbox", { name: "Pasar también las tiendas que comparten el almacén" });
  expect(within(dialog).getByText(/hermana\.myshopify\.com\. Comparten el almacén/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/otra\.myshopify\.com/)).not.toBeInTheDocument();

  await user.click(within(dialog).getByRole("checkbox", { name: "Confirmar que Powip pase a mandar el stock" }));
  await user.click(within(dialog).getByRole("button", { name: "Pasar a «Powip manda»" }));
  expect(await within(dialog).findByText("Otras tiendas usan el mismo almacén y no están en «Powip manda»")).toBeInTheDocument();

  await user.click(group);
  await user.click(within(dialog).getByRole("button", { name: "Pasar a «Powip manda»" }));
  await waitFor(() =>
    expect(mockChange).toHaveBeenLastCalledWith("shop-1", expect.objectContaining({ mode: "powip", confirm: true, groupShopIds: ["shop-2"] })),
  );
  expect(await within(dialog).findByText("En hermana.myshopify.com:")).toBeInTheDocument();
  expect(within(dialog).getByText("Falta un reporte completo y sin errores en «Solo reporte»")).toBeInTheDocument();
});

it("volver a «Shopify manda» siempre se ofrece, con el aviso, y no manda ubicación", async () => {
  const user = userEvent.setup();
  const powip = shop({ id: "shop-1", shopUrl: "uno.myshopify.com", stockMode: "powip" });
  mockChange.mockResolvedValueOnce(result({ requestedMode: "shopify", previousMode: "powip", currentMode: "shopify" }) as never);
  const { onChanged } = renderDialog(powip, [powip]);
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByRole("radio", { name: /Shopify manda/ })).toBeChecked();
  expect(within(dialog).getByText(/Shopify vuelve a mandar: Powip deja de publicar/)).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Ubicación de Shopify")).not.toBeInTheDocument();
  expect(mockLocations).not.toHaveBeenCalled();

  await user.click(within(dialog).getByRole("button", { name: "Volver a «Shopify manda»" }));
  await waitFor(() => expect(mockChange).toHaveBeenCalledWith("shop-1", { mode: "shopify" }));
  expect(toast.success).toHaveBeenCalledWith("uno.myshopify.com quedó en «Shopify manda».");
  expect(onChanged).toHaveBeenCalled();
});

it("un 409 avisa y refresca; un 403 avisa", async () => {
  const user = userEvent.setup();
  const powip = shop({ id: "shop-1", shopUrl: "uno.myshopify.com", stockMode: "powip" });
  mockChange.mockRejectedValueOnce(http(409, { message: "carrera", currentMode: "reporte" }));
  const { onChanged, onOpenChange } = renderDialog(powip, [powip]);
  const dialog = await screen.findByRole("dialog");

  await user.click(within(dialog).getByRole("button", { name: "Volver a «Shopify manda»" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "La tienda cambió mientras se revisaba el pedido. Revisa su estado y vuelve a intentarlo.",
    ),
  );
  expect(onChanged).toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalledWith(false);

  mockChange.mockRejectedValueOnce(http(403, { message: "Solo un administrador…" }));
  await user.click(within(dialog).getByRole("button", { name: "Volver a «Shopify manda»" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenLastCalledWith("Solo un administrador de la empresa puede cambiar el modo de stock."),
  );
});

it("pasar a «Solo reporte» manda la ubicación elegida, sin confirmación", async () => {
  const user = userEvent.setup();
  const nueva = shop({ id: "shop-1", shopUrl: "uno.myshopify.com", stockMode: "shopify", stockLocationId: null });
  mockChange.mockResolvedValueOnce(result({ requestedMode: "reporte", previousMode: "shopify", currentMode: "reporte" }) as never);
  renderDialog(nueva, [nueva]);
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByRole("radio", { name: /Solo reporte/ })).toBeChecked();
  const select = await within(dialog).findByLabelText("Ubicación de Shopify");
  // Dos activas y ninguna guardada: no elige sola.
  expect(select).toHaveValue("");
  await user.selectOptions(select, "gid://shopify/Location/111");
  expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Pasar a «Solo reporte»" }));
  await waitFor(() =>
    expect(mockChange).toHaveBeenCalledWith("shop-1", { mode: "reporte", stockLocationId: "gid://shopify/Location/111" }),
  );
});
