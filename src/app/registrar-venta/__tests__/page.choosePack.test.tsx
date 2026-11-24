/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * FEAT-32 M6b — vender el pack «a elegir» en Registrar venta (spec §6.14, §7.17).
 *
 * Página, buscador de packs, ventana «Elige talla y color», carrito (CartLines real) y payload son reales.
 * HTTP, sesión, navegación, cliente y motor de promociones van mockeados; el stock por variante del almacén
 * (`getStockByVariants`) también. Radix Select usa un adaptador nativo (jsdom no tiene pointer capture).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: {
  get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(),
} }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/registrar-venta",
  useSearchParams: () => mockSearchParams,
}));
jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(), createClient: jest.fn(), updateClient: jest.fn(),
}));
jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]), createVolumePromo: jest.fn(), updatePromo: jest.fn(), deletePromo: jest.fn(),
}));
jest.mock("@/services/bundlePromos.service", () => ({
  listBundlePromos: jest.fn().mockResolvedValue({ bundles: [], deletedIds: [] }),
  getBundleCapabilities: jest.fn().mockResolvedValue({ canManage: false }),
  importBundlePromos: jest.fn(), createBundlePromo: jest.fn(), updateBundlePromo: jest.fn(), deleteBundlePromo: jest.fn(),
}));
// Motor de promociones sin promos: no forma parte de lo que se prueba aquí.
jest.mock("@/services/promotionsService", () => ({
  resolvePrices: async () => [],
  evaluateSaleEngine: async () => ({
    lines: [], gift: null, giftOptions: [], suggestions: [],
    totals: { listSubtotal: 0, promoDiscount: 0, subtotal: 0 }, priceFallback: false,
  }),
}));
jest.mock("@/services/inventoryItems.service", () => ({
  searchInventoryItems: jest.fn(),
  getStockByVariants: jest.fn(),
}));
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  function text(node: any): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    return Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  }
  function Select({ value, onValueChange, children, disabled }: any) {
    const options: Array<{ value: string; label: string }> = [];
    function visit(nodes: any) {
      React.Children.forEach(nodes, (node: any) => {
        if (!React.isValidElement(node)) return;
        const props = node.props as any;
        if (props.value !== undefined) options.push({ value: props.value, label: text(props.children) });
        else visit(props.children);
      });
    }
    visit(children);
    return <select value={value ?? ""} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)}>
      <option value="">Selecciona</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  const Pass = ({ children }: any) => <>{children}</>;
  return { Select, SelectContent: Pass, SelectTrigger: Pass, SelectItem: Pass, SelectValue: () => null };
});
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/orderReceiptModal", () => ({ __esModule: true, default: () => null }));

import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClientByPhone, updateClient } from "@/services/clients.service";
import { getStockByVariants, searchInventoryItems, type VariantStock } from "@/services/inventoryItems.service";
import type { PackView } from "@/services/packsService";
import RegistrarVentaPage from "../page";

const http = axiosAuth as unknown as { get: jest.Mock; post: jest.Mock; put: jest.Mock; patch: jest.Mock };
const PACK_VARIANT = "aaaaaaaa-0000-4000-8000-000000000001";
const PACK_KEY = `${PACK_VARIANT}:0123456789abcdef`;
const client = {
  id: "client-1", companyId: "company-1", fullName: "Cliente ficticio", phoneNumber: "999888777",
  clientType: "TRADICIONAL", province: "Lima", city: "Lima", district: "Miraflores", address: "Calle ficticia 123", isActive: true,
};
const context = {
  companyId: "company-1",
  stores: [{ id: "store-a", name: "Marca A" }],
  inventories: [{ id: "warehouse-a", name: "Almacén A", storeId: "store-a" }],
};
const variant = (variantId: string, sku: string, attributeValues: Record<string, string>) => ({ variantId, sku, attributeValues, active: true, imageUrl: null });
const JEANS: PackView = {
  id: "p-jeans", variantId: PACK_VARIANT, name: "Pack jeans", description: null, sku: "PCK-0002", productSku: "PCK", powipEan: null,
  barcode: null, imageUrl: null, price: 259, active: true, categoryId: null, brandId: null, components: [], packType: "CHOOSE", approvalStatus: null,
  choiceComponents: [
    {
      slot: 0, productId: "p-jim", productName: "Jean Jimena", quantity: 2,
      variants: [variant("jim-s", "JIM-S", { Talla: "S" }), variant("jim-m", "JIM-M", { Talla: "M" }), variant("jim-l", "JIM-L", { Talla: "L" })],
    },
    { slot: 1, productId: "p-polo", productName: "Polo Luisa", quantity: 1, variants: [variant("pol-u", "POL-U", { Talla: "U" })] },
  ],
  available: { total: 3, byWarehouse: [{ inventoryId: "warehouse-a", inventoryName: "Almacén A", storeId: "store-a", available: 3 }] },
};
const stock = (variantId: string, quantity: number): VariantStock => ({
  variant_id: variantId, quantity, reserved_quantity: 0, available: quantity,
  inventories: [{ inventory_id: "warehouse-a", inventory_name: "Almacén A", store_id: "store-a", quantity, reserved_quantity: 0 }],
});
const loadedLine = (packKey: string) => ({
  productVariantId: PACK_VARIANT, productName: "Pack jeans", sku: "PCK-0002", attributes: {}, quantity: 1,
  unitPrice: "259.00", discountAmount: "0.00", imageUrl: null, packKey,
  packComponents: [
    { variantId: "jim-m", quantity: 2, sku: "JIM-M", productName: "Jean Jimena" },
    { variantId: "pol-u", quantity: 1, sku: "POL-U", productName: "Polo Luisa" },
  ],
});
const order = (packKey: string) => ({
  id: "order-choose", orderNumber: "ORD-1", storeId: "store-a", inventoryId: "warehouse-a", stockStoreId: "store-a", stockVersion: 1,
  companyId: "company-1", orderType: "VENTA", status: "PENDIENTE", salesChannel: "WHATSAPP", closingChannel: "WHATSAPP",
  deliveryType: "RETIRO_TIENDA", salesRegion: "LIMA", courier: null, notes: "", shippingTotal: 0, taxMode: "INCLUIDO",
  callStatus: null, callbackAt: null, customer: client, items: [loadedLine(packKey)],
  payments: [{ id: "payment-1", status: "PAID", paymentMethod: "EFECTIVO", amount: 259, created_at: "2026-11-20T10:00:00.000Z" }],
});
let loadedKey = PACK_KEY;

beforeAll(() => {
  let seq = 0;
  if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: () => `cart-line-${++seq}` });
});
beforeEach(() => {
  jest.clearAllMocks();
  tokenStore.set("fixture-token", JSON.stringify(["seller-1", "company-1"]));
  mockSearchParams = new URLSearchParams();
  loadedKey = PACK_KEY;
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "seller-1", name: "Vendedora", surname: "Ficticia", email: "fixture@example.test", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Empresa ficticia", stores: context.stores }, accessToken: "fixture-token", subscription: null, exp: 9999999999 },
    selectedStoreId: "store-a", setSelectedStore: jest.fn(), inventories: context.inventories,
    loading: false, hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(fetchClientByPhone).mockResolvedValue(client as any);
  jest.mocked(updateClient).mockResolvedValue(client as any);
  jest.mocked(searchInventoryItems).mockResolvedValue({ data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 } });
  jest.mocked(getStockByVariants).mockResolvedValue([stock("jim-s", 4), stock("jim-m", 6), stock("jim-l", 0), stock("pol-u", 9)]);
  http.get.mockImplementation((url: string) => {
    if (url.endsWith("/order-header/sale-context")) return Promise.resolve({ data: context });
    if (url.endsWith("/order-header/manual/order-choose")) return Promise.resolve({ data: order(loadedKey) });
    if (url.endsWith("/packs")) return Promise.resolve({ data: { data: [JEANS], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } } });
    if (url.endsWith("/packs/p-jeans")) return Promise.resolve({ data: JEANS });
    return Promise.resolve({ data: [] });
  });
  http.post.mockResolvedValue({ data: { id: "order-created", payments: [] } });
  http.put.mockResolvedValue({ data: order(PACK_KEY) });
});

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><RegistrarVentaPage /></QueryClientProvider>);
}
function field(label: RegExp) {
  const element = screen.getByText((_text, node) => node?.tagName === "LABEL" && label.test(node.textContent ?? ""));
  return within(element.parentElement!);
}
async function fillRequired() {
  const user = userEvent.setup();
  await screen.findByDisplayValue("Almacén A");
  await user.type(screen.getByPlaceholderText("Número de teléfono"), `${client.phoneNumber}{Enter}`);
  await screen.findByText(/cliente encontrado/i);
  await user.selectOptions(field(/método de pago/i).getByRole("combobox"), "EFECTIVO");
  await user.selectOptions(field(/canal de venta/i).getByRole("combobox"), "WHATSAPP");
  await user.selectOptions(field(/canal de cierre/i).getByRole("combobox"), "WHATSAPP");
  await user.selectOptions(field(/tipo de entrega/i).getByRole("combobox"), "RETIRO_TIENDA");
  return user;
}
/** Elige en la ventana abierta: la primera unidad del jean (las demás arrancan iguales), la segunda si se pide, y el polo. */
async function choose(user: ReturnType<typeof userEvent.setup>, first: string, second?: string) {
  const dialog = await screen.findByRole("dialog", { name: "Elige talla y color" });
  await user.selectOptions(await within(dialog).findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" }), first);
  if (second) await user.selectOptions(within(dialog).getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" }), second);
  await user.selectOptions(within(dialog).getByRole("combobox", { name: "Polo Luisa" }), "pol-u");
  return dialog;
}
async function addChosen(user: ReturnType<typeof userEvent.setup>, first: string, second?: string) {
  await user.click(await screen.findByRole("button", { name: "Elegir variantes del pack Pack jeans" }));
  const dialog = await choose(user, first, second);
  await user.click(within(dialog).getByRole("button", { name: "Agregar al pedido" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Elige talla y color" })).not.toBeInTheDocument());
}

describe("Registrar venta — FEAT-32 M6b pack «a elegir»", () => {
  it("venta nueva: elige talla y color por unidad y manda packChoice con la variante, el SKU y el precio del pack", async () => {
    mountPage();
    const user = await fillRequired();
    await user.click(await screen.findByRole("button", { name: "Elegir variantes del pack Pack jeans" }));
    const dialog = await screen.findByRole("dialog", { name: "Elige talla y color" });
    // Las variantes sin stock en el almacén de salida no se ofrecen.
    const unit = await within(dialog).findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" });
    expect(within(unit).queryByRole("option", { name: /JIM-L/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Agregar al pedido" })).toBeDisabled();
    await choose(user, "jim-m");
    await user.click(within(dialog).getByRole("button", { name: "Agregar al pedido" }));

    // La línea: el pack con su SKU y, debajo, lo elegido.
    const contents = await screen.findByTestId("pack-line-contents");
    expect(contents).toHaveTextContent("2 × Jean Jimena M");
    expect(contents).toHaveTextContent("1 × Polo Luisa U");
    expect(within(contents.parentElement!).getByText("Pack jeans")).toBeInTheDocument();
    expect(within(contents.parentElement!).getByText("PCK-0002")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /registrar pedido/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual$/), expect.anything()));
    const [item] = http.post.mock.calls.find(([url]) => /\/order-header\/manual$/.test(url))![1].items;
    expect(item).toMatchObject({
      productVariantId: PACK_VARIANT, sku: "PCK-0002", unitPrice: 259, quantity: 1,
      packChoice: [{ slot: 0, variantId: "jim-m", quantity: 2 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
    });
    expect(item).not.toHaveProperty("packKey");
    expect(getStockByVariants).toHaveBeenCalledWith(["jim-l", "jim-m", "jim-s", "pol-u"]);
  }, 20000);

  it("la misma combinación suma cantidad; una combinación distinta es otra línea", async () => {
    mountPage();
    const user = await fillRequired();
    await addChosen(user, "jim-m");
    await addChosen(user, "jim-m");
    await addChosen(user, "jim-s", "jim-m");
    expect(screen.getAllByTestId("pack-line-contents")).toHaveLength(2);

    const submit = screen.getByRole("button", { name: /registrar pedido/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual$/), expect.anything()));
    const { items } = http.post.mock.calls.find(([url]) => /\/order-header\/manual$/.test(url))![1];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ productVariantId: PACK_VARIANT, quantity: 2, packChoice: [{ slot: 0, variantId: "jim-m", quantity: 2 }, { slot: 1, variantId: "pol-u", quantity: 1 }] });
    expect(items[1]).toMatchObject({
      productVariantId: PACK_VARIANT, quantity: 1,
      packChoice: [{ slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
    });
  }, 30000);

  it("al editar sin cambiar la elección reenvía la packKey que trajo el pedido", async () => {
    mockSearchParams = new URLSearchParams({ orderId: "order-choose" });
    mountPage();
    expect(await screen.findByTestId("pack-line-contents")).toHaveTextContent("2 × Jean Jimena");
    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(http.put).toHaveBeenCalled());
    const [item] = http.put.mock.calls[0][1].items;
    expect(item).toMatchObject({ productVariantId: PACK_VARIANT, quantity: 1, packKey: PACK_KEY });
    expect(item).not.toHaveProperty("packChoice");
  }, 20000);

  it("al editar, «Cambiar variantes» manda packChoice en vez de la packKey", async () => {
    mockSearchParams = new URLSearchParams({ orderId: "order-choose" });
    mountPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cambiar variantes de Pack jeans" }));
    const dialog = await screen.findByRole("dialog", { name: "Elige talla y color" });
    // Arranca con lo que tiene la línea.
    expect(await within(dialog).findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" })).toHaveValue("jim-m");
    expect(within(dialog).getByRole("combobox", { name: "Polo Luisa" })).toHaveValue("pol-u");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" }), "jim-s");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByTestId("pack-line-contents")).toHaveTextContent("1 × Jean Jimena S"));

    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.put).toHaveBeenCalled());
    const [item] = http.put.mock.calls[0][1].items;
    expect(item).toMatchObject({
      productVariantId: PACK_VARIANT, sku: "PCK-0002",
      packChoice: [{ slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
    });
    expect(item).not.toHaveProperty("packKey");
    // El pack de la línea cargada se busca por su SKU.
    expect(http.get).toHaveBeenCalledWith(expect.stringMatching(/\/packs$/), expect.objectContaining({ params: { q: "PCK-0002", limit: 50 } }));
  }, 20000);

  it("no deja registrar una línea «a elegir» sin la elección completa hasta elegir talla y color", async () => {
    loadedKey = "combinacion-vieja";
    mockSearchParams = new URLSearchParams({ orderId: "order-choose" });
    mountPage();
    const user = userEvent.setup();
    expect(await screen.findByText("Elige talla y color de Pack jeans")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(http.put).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cambiar variantes de Pack jeans" }));
    const dialog = await choose(user, "jim-s");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByText("Elige talla y color de Pack jeans")).not.toBeInTheDocument());
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.put).toHaveBeenCalled());
    const [item] = http.put.mock.calls[0][1].items;
    // Arrancó con el contenido guardado (M, M): se cambió solo la primera unidad.
    expect(item.packChoice).toEqual([{ slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }]);
    expect(item).not.toHaveProperty("packKey");
  }, 20000);
});
