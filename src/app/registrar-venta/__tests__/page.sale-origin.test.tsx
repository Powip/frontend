/* eslint-disable @typescript-eslint/no-require-imports */
/** Full-page sale origin verification with fictitious data.
 * The page, origin hook/fields, client form, cart state, submission logic and
 * sale-context HTTP service are real. HTTP/Auth/navigation are mocked.
 * Radix Select uses a native adapter because jsdom has no pointer capture;
 * catalogue matrix, suggestions and receipt visuals are outside this contract.
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
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/registrar-venta",
  useSearchParams: () => mockSearchParams,
}));
jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(), createClient: jest.fn(), updateClient: jest.fn(),
}));
jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]), createVolumePromo: jest.fn(), updatePromo: jest.fn(), deletePromo: jest.fn(),
}));
jest.mock("@/services/inventoryItems.service", () => ({
  searchInventoryItems: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, total: 0, totalPages: 1 } }),
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
    let id: string | undefined;
    function visit(nodes: any) {
      React.Children.forEach(nodes, (node: any) => {
        if (!React.isValidElement(node)) return;
        if (node.props.id) id = node.props.id;
        if (node.props.value !== undefined) options.push({ value: node.props.value, label: text(node.props.children) });
        else visit(node.props.children);
      });
    }
    visit(children);
    return <select id={id} value={value ?? ""} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)}>
      <option value="">Selecciona</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  const Pass = ({ children }: any) => <>{children}</>;
  return { Select, SelectContent: Pass, SelectTrigger: Pass, SelectItem: Pass, SelectValue: () => null };
});
jest.mock("@/components/registrar-venta/ProductSearchMatrix", () => ({
  __esModule: true,
  default: ({ onAddVariant }: any) => <button type="button" onClick={() => onAddVariant({
    inventoryItemId: "item-in-warehouse-a", variantId: "variant-1", productName: "Producto ficticio",
    sku: "FIXTURE-1", price: 100, availableStock: 10, physicalStock: 10,
  })}>Agregar producto ficticio</button>,
}));
jest.mock("@/components/registrar-venta/CartLines", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/orderReceiptModal", () => ({ __esModule: true, default: () => null }));

import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClientByPhone, updateClient } from "@/services/clients.service";
import type { SaleSalesChannel } from "@/services/saleContextService";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import RegistrarVentaPage from "../page";

const http = axiosAuth as unknown as { get: jest.Mock; post: jest.Mock; put: jest.Mock; patch: jest.Mock };
const mockSetNavigationStore = jest.fn();
const client = {
  id: "client-1", companyId: "company-1", fullName: "Cliente ficticio", phoneNumber: "999888777",
  clientType: "TRADICIONAL", province: "Lima", city: "Lima", district: "Miraflores", address: "Calle ficticia 123", isActive: true,
};
const context = {
  companyId: "company-1",
  stores: [{ id: "store-a", name: "Marca A" }, { id: "store-b", name: "Marca B" }],
  inventories: [{ id: "warehouse-a", name: "Almacén compartido A", storeId: "store-a" }],
};
const existingOrder = {
  id: "order-existing", orderNumber: "ORD-FIXTURE", storeId: "store-b", inventoryId: "warehouse-a",
  stockStoreId: "store-a", stockVersion: 1, companyId: "company-1", orderType: "VENTA", status: "PREPARADO",
  salesChannel: "WHATSAPP", closingChannel: "WHATSAPP", deliveryType: "RETIRO_TIENDA", salesRegion: "LIMA",
  courier: null, notes: "", shippingTotal: 0, taxMode: "AUTOMATICO", callStatus: null, callbackAt: null,
  customer: client,
  items: [{ productVariantId: "variant-1", productName: "Producto ficticio", sku: "FIXTURE-1", attributes: {},
    quantity: 1, unitPrice: 100, discountAmount: 0, imageUrl: null }],
  payments: [{ id: "payment-1", status: "PAID", paymentMethod: "EFECTIVO", amount: 100, created_at: "2026-10-01T10:00:00.000Z" }],
};
let responseContext: typeof context & { channels?: SaleSalesChannel[]; inventoryStoreIds?: string[] };
let responseOrder: typeof existingOrder | (Omit<typeof existingOrder, "inventoryId" | "stockStoreId"> & { inventoryId: null; stockStoreId: null });
let contextFails: boolean;
let orderFails: boolean;
let courierFails: boolean;
let courierRecords: { id: string; name: string; companyId: string }[];

beforeAll(() => {
  if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: () => "fixture-cart-id" });
});
beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  responseContext = context;
  responseOrder = existingOrder;
  contextFails = false;
  orderFails = false;
  courierFails = false;
  courierRecords = [];
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "seller-1", name: "Vendedora", surname: "Ficticia", email: "fixture@example.test", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Empresa ficticia", stores: context.stores }, accessToken: "fixture-token", subscription: null, exp: 9999999999 },
    selectedStoreId: "store-a", setSelectedStore: mockSetNavigationStore, inventories: context.inventories,
    loading: false, hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(fetchClientByPhone).mockResolvedValue(client as any);
  jest.mocked(updateClient).mockResolvedValue(client as any);
  http.get.mockImplementation((url: string) => {
    if (url.endsWith("/order-header/sale-context")) return contextFails ? Promise.reject(new Error("Context unavailable")) : Promise.resolve({ data: responseContext });
    if (url.endsWith("/order-header/manual/order-existing")) return orderFails ? Promise.reject(new Error("Order unavailable")) : Promise.resolve({ data: responseOrder });
    if (url.includes("/couriers/company/")) return courierFails ? Promise.reject(new Error("Couriers unavailable")) : Promise.resolve({ data: courierRecords });
    return Promise.resolve({ data: [] });
  });
  http.post.mockResolvedValue({ data: { id: "order-created", payments: [] } });
  http.put.mockResolvedValue({ data: existingOrder });
});

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><RegistrarVentaPage /></QueryClientProvider>);
}
function field(label: RegExp) {
  const element = screen.getByText((_text, node) => node?.tagName === "LABEL" && label.test(node.textContent ?? ""));
  return within(element.parentElement!);
}
async function fillRequired(channelChoice = "WHATSAPP") {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Número de teléfono"), `${client.phoneNumber}{Enter}`);
  await screen.findByText(/cliente encontrado/i);
  await user.click(screen.getByRole("button", { name: /agregar producto ficticio/i }));
  await user.selectOptions(field(/método de pago/i).getByRole("combobox"), "EFECTIVO");
  await user.selectOptions(field(/canal de venta/i).getByRole("combobox"), channelChoice);
  await user.selectOptions(field(/canal de cierre/i).getByRole("combobox"), "WHATSAPP");
  await user.selectOptions(field(/tipo de entrega/i).getByRole("combobox"), "RETIRO_TIENDA");
  return user;
}
async function waitContext() {
  await screen.findByDisplayValue("Almacén compartido A");
}

describe("Registrar venta — tienda comercial y almacén independientes", () => {
  it("recupera una carga fallida de métodos de envío y ofrece el courier real de la empresa", async () => {
    courierFails = true;
    mountPage();
    expect(await screen.findByText("No se pudieron cargar los métodos de envío.")).toBeInTheDocument();
    courierFails = false;
    courierRecords = [{ id: "real-shalom-id", name: "Shalom", companyId: "company-1" }];
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("option", { name: "Shalom" })).toHaveValue("Shalom");
    expect(screen.queryByText("No se pudieron cargar los métodos de envío.")).not.toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("navbar A y almacén A permiten vender para B; POST manual conserva ambos y no cambia navegación", async () => {
    mountPage();
    await waitContext();
    expect(field(/tienda de la venta/i).getByRole("combobox")).toHaveValue("");
    const user = await fillRequired();
    await user.selectOptions(field(/tienda de la venta/i).getByRole("combobox"), "store-b");
    expect(screen.getByRole("button", { name: /confirmar venta/i })).toBeDisabled();
    await user.selectOptions(field(/canal de venta/i).getByRole("combobox"), "legacy:WHATSAPP");
    expect(screen.getByDisplayValue("Almacén compartido A")).toHaveAttribute("readonly");
    const submit = screen.getByRole("button", { name: /confirmar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual$/),
      expect.objectContaining({ storeId: "store-b", inventoryId: "warehouse-a", currency: "PEN", items: [expect.objectContaining({ productVariantId: "variant-1", quantity: 1 })] })));
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("companyId");
    expect(mockSetNavigationStore).not.toHaveBeenCalled();
    expect(jest.mocked(searchInventoryItems).mock.calls[0][0]).toEqual(expect.objectContaining({ inventoryId: "warehouse-a", companyId: "company-1" }));
  }, 15000);

  it("envía el canal identificado de la tienda y moneda PEN explícita con el almacén existente", async () => {
    responseContext = { ...context, channels: [{ id: "channel-b", storeId: "store-b", type: "WHATSAPP", label: "WhatsApp Marca B", identifier: "+51999888777", externalId: null }] };
    mountPage();
    await waitContext();
    const user = userEvent.setup();
    await user.selectOptions(field(/tienda de la venta/i).getByRole("combobox"), "store-b");
    await fillRequired("channel-b");
    const submit = screen.getByRole("button", { name: /confirmar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual$/), expect.objectContaining({ storeId: "store-b", inventoryId: "warehouse-a", salesChannelId: "channel-b", currency: "PEN" })));
  }, 15000);

  it("ofrece crear una tienda comercial sin ocultar el almacén de la tienda anterior", async () => {
    responseContext = { ...context, stores: [], inventoryStoreIds: ["store-a"], channels: [] };
    mountPage();
    await waitContext();
    expect(screen.getByRole("link", { name: "Crear tienda comercial" })).toHaveAttribute("href", "/configuracion/tiendas");
    expect(screen.getByDisplayValue("Almacén compartido A")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /confirmar venta/i })).toBeDisabled();
  });

  it("con varias tiendas no adopta navbar A; falta elegir tienda y bloquea una venta válida en lo demás", async () => {
    mountPage();
    await waitContext();
    const user = await fillRequired();
    const submit = screen.getByRole("button", { name: /confirmar venta/i });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(http.post).not.toHaveBeenCalled();
    expect(mockSetNavigationStore).not.toHaveBeenCalled();
  }, 15000);

  it("fallo de contexto muestra recuperación y bloquea el guardado", async () => {
    contextFails = true;
    mountPage();
    expect(await screen.findByText(/no se pudieron cargar las tiendas y los almacenes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeEnabled();
    const submit = screen.getByRole("button", { name: /confirmar venta/i });
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("edita por GET manual, origen B/A readonly y PUT full no reasigna tienda ni almacén", async () => {
    mockSearchParams = new URLSearchParams({ orderId: existingOrder.id });
    mountPage();
    expect(await screen.findByDisplayValue("Marca B")).toHaveAttribute("readonly");
    expect(await screen.findByDisplayValue("Almacén compartido A")).toHaveAttribute("readonly");
    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(http.put).toHaveBeenCalled());
    const [url, body] = http.put.mock.calls[0];
    expect(url).toMatch(/\/order-header\/manual\/order-existing\/full$/);
    expect(body).not.toHaveProperty("storeId");
    expect(body).not.toHaveProperty("inventoryId");
    expect(body).not.toHaveProperty("stockStoreId");
    expect(http.get).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual\/order-existing$/), expect.anything());
    expect(http.post).not.toHaveBeenCalled();
    expect(mockSetNavigationStore).not.toHaveBeenCalled();
  }, 15000);

  it("edición legacy con snapshot null conserva el almacén desconocido y permite actualizar sin hidratarlo", async () => {
    responseOrder = { ...existingOrder, inventoryId: null, stockStoreId: null, stockVersion: 0 };
    mockSearchParams = new URLSearchParams({ orderId: existingOrder.id });
    mountPage();
    expect(await screen.findByDisplayValue("Almacén no registrado")).toHaveAttribute("readonly");
    expect(await screen.findByDisplayValue("Marca B")).toHaveAttribute("readonly");
    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(http.put).toHaveBeenCalled());
    expect(http.put.mock.calls[0][1]).not.toHaveProperty("inventoryId");
    expect(http.put.mock.calls[0][1]).not.toHaveProperty("stockStoreId");
    expect(http.post).not.toHaveBeenCalled();
    expect(mockSetNavigationStore).not.toHaveBeenCalled();
  }, 15000);

  it("carga fallida de edición no se convierte en venta nueva", async () => {
    orderFails = true;
    mockSearchParams = new URLSearchParams({ orderId: existingOrder.id });
    mountPage();
    await waitFor(() => expect(http.get).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual\/order-existing$/), expect.anything()));
    const submit = screen.getByRole("button", { name: /actualizar venta/i });
    await waitFor(() => expect(submit).toBeDisabled());
    await userEvent.click(submit);
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
  });
});
