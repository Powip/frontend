/* eslint-disable @typescript-eslint/no-require-imports */
/** Registrar venta — «Recojo en agencia» (PUNTO_EXTERNO) y buscador de agencias Shalom.
 * Mismo arnés que page.sale-origin.test.tsx: la página, el formulario y el buscador de agencias son
 * reales; HTTP/Auth/navegación van con mocks y datos ficticios. Nada sale a Shalom ni a ms-ventas.
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
// FEAT-24 H9: precio sugerido y regalos del backend; no forman parte de lo que se prueba aquí.
jest.mock("@/services/promotionsService", () => ({
  resolvePrices: async () => [],
  evaluatePromotions: async () => ({ gifts: [] }),
}));
jest.mock("@/services/inventoryItems.service", () => ({
  searchInventoryItems: jest.fn(),
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
jest.mock("@/components/registrar-venta/CartLines", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/orderReceiptModal", () => ({ __esModule: true, default: () => null }));

import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClientByPhone, updateClient } from "@/services/clients.service";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { toast } from "sonner";
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
const catalogueProduct = {
  inventoryItemId: "item-in-warehouse-a", variantId: "variant-1", productName: "Producto ficticio",
  sku: "FIXTURE-1", price: 100, availableStock: 10, physicalStock: 10, attributes: { color: "Dorado" },
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
let responseContext: typeof context;
let responseOrder: typeof existingOrder | (Omit<typeof existingOrder, "inventoryId" | "stockStoreId"> & { inventoryId: null; stockStoreId: null });
let contextFails: boolean;
let orderFails: boolean;
const shalomAgencies = [
  { ter_id: 101, nombre: "MIRAFLORES CENTRO", lugar_over: "MIRAFLORES CENTRO LIMA", lugar: "Av. Ficticia 100", ter_aereo: 0, departamento: "LIMA", provincia: "LIMA" },
  { ter_id: 102, nombre: "MIRAFLORES OVALO", lugar_over: "MIRAFLORES OVALO LIMA", lugar: "Calle Ficticia 200", ter_aereo: 1, departamento: "LIMA", provincia: "LIMA" },
  { ter_id: 103, nombre: "SURCO CHACARILLA", lugar_over: "SURCO CHACARILLA LIMA", lugar: "Jr. Ficticio 300", ter_aereo: 0, departamento: "LIMA", provincia: "LIMA" },
  { ter_id: 104, nombre: "CUSCO WANCHAQ", lugar_over: "CUSCO WANCHAQ", lugar: "Av. Ficticia 400", ter_aereo: 1, departamento: "CUSCO", provincia: "CUSCO" },
];
let courierRecords: { id: string; name: string; companyId: string }[];

beforeAll(() => {
  if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: () => "fixture-cart-id" });
});
beforeEach(() => {
  jest.clearAllMocks();
  tokenStore.set("fixture-token", JSON.stringify(["seller-1", "company-1"]));
  mockSearchParams = new URLSearchParams();
  responseContext = context;
  responseOrder = existingOrder;
  contextFails = false;
  orderFails = false;
  courierRecords = [{ id: "courier-shalom", name: "Shalom", companyId: "company-1" }];
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "seller-1", name: "Vendedora", surname: "Ficticia", email: "fixture@example.test", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Empresa ficticia", stores: context.stores }, accessToken: "fixture-token", subscription: null, exp: 9999999999 },
    selectedStoreId: "store-a", setSelectedStore: mockSetNavigationStore, inventories: context.inventories,
    loading: false, hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(fetchClientByPhone).mockResolvedValue(client as any);
  jest.mocked(updateClient).mockResolvedValue(client as any);
  jest.mocked(searchInventoryItems).mockResolvedValue({
    data: [catalogueProduct], meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
  });
  http.get.mockImplementation((url: string) => {
    if (url.endsWith("/order-header/sale-context")) return contextFails ? Promise.reject(new Error("Context unavailable")) : Promise.resolve({ data: responseContext });
    if (url.endsWith("/order-header/manual/order-existing")) return orderFails ? Promise.reject(new Error("Order unavailable")) : Promise.resolve({ data: responseOrder });
    if (url.includes("/couriers/company/")) return Promise.resolve({ data: courierRecords });
    if (url.includes("/shalom/agencies")) return Promise.resolve({ data: { success: true, total: shalomAgencies.length, data: shalomAgencies } });
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
const deliveryType = () => field(/tipo de entrega/i).getByRole("combobox");
const submitButton = () => screen.getByRole("button", { name: /registrar pedido/i });
const agencyCalls = () => http.get.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/shalom/agencies"));
const postedOrder = () => http.post.mock.calls[0][1];

/** Completa todo lo obligatorio salvo la entrega. */
async function fillSale() {
  const user = userEvent.setup();
  await screen.findByDisplayValue("Almacén compartido A");
  await user.type(screen.getByPlaceholderText("Número de teléfono"), `${client.phoneNumber}{Enter}`);
  await screen.findByText(/cliente encontrado/i);
  await user.click(await screen.findByRole("button", { name: /producto ficticio FIXTURE-1/i }));
  await user.click(screen.getByRole("button", { name: /color: Dorado FIXTURE-1/i }));
  await user.selectOptions(field(/método de pago/i).getByRole("combobox"), "EFECTIVO");
  await user.selectOptions(field(/tienda de la venta/i).getByRole("combobox"), "store-a");
  await user.selectOptions(field(/canal de venta/i).getByRole("combobox"), "legacy:WHATSAPP");
  await user.selectOptions(field(/canal de cierre/i).getByRole("combobox"), "WHATSAPP");
  return user;
}
async function chooseShalomAgency(user: ReturnType<typeof userEvent.setup>, apiName = "MIRAFLORES CENTRO LIMA") {
  const agency = field(/^agencia$/i).getByRole("combobox");
  await within(agency).findByRole("option", { name: /MIRAFLORES CENTRO/ });
  await user.selectOptions(agency, apiName);
}

describe("Registrar venta — recojo en agencia al registrar una venta nueva", () => {
  it("ofrece «Recojo en agencia» junto a retiro en tienda y envío a domicilio", async () => {
    mountPage();
    await screen.findByDisplayValue("Almacén compartido A");
    const options = within(deliveryType()).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(["Retiro en tienda", "Envío a domicilio", "Recojo en agencia"]));
    expect(options).not.toContain("Envío a agencia");
  });

  it("con Shalom carga el catálogo, lo filtra por el distrito del cliente y guarda la agencia elegida", async () => {
    http.post.mockResolvedValue({ data: { id: "order-created", payments: [], deliverySnapshot: { type: "AGENCY", agency: "Shalom — MIRAFLORES CENTRO" } } });
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "PUNTO_EXTERNO");
    expect(submitButton()).toBeDisabled();
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    expect(screen.getByText("FALTANTE")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    const agency = field(/^agencia$/i).getByRole("combobox");
    await within(agency).findByRole("option", { name: /MIRAFLORES CENTRO/ });
    // Cliente en Lima / Lima / Miraflores: solo las agencias de su distrito.
    expect(within(agency).getAllByRole("option").slice(1).map((option) => option.getAttribute("value")))
      .toEqual(["MIRAFLORES CENTRO LIMA", "MIRAFLORES OVALO LIMA"]);
    expect(screen.getByText("Mostrando las agencias del distrito Miraflores (2).")).toBeInTheDocument();
    await chooseShalomAgency(user);
    expect(agencyCalls()).toHaveLength(1);
    expect(agencyCalls()[0]).toMatch(/\/shalom\/agencies$/);
    expect(screen.getByText("Shalom — MIRAFLORES CENTRO")).toBeInTheDocument();

    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.click(submitButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(postedOrder()).toEqual(expect.objectContaining({
      deliveryType: "PUNTO_EXTERNO", courier: "Shalom", delivery: { agency: "Shalom — MIRAFLORES CENTRO" },
    }));
    expect(toast.warning).not.toHaveBeenCalled();
  }, 20000);

  it("envío a domicilio con Shalom: elegir una agencia pasa el pedido a «Recojo en agencia»", async () => {
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "DOMICILIO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    expect(screen.getByText(/el tipo de entrega cambia a «Recojo en agencia»/)).toBeInTheDocument();
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await chooseShalomAgency(user, "MIRAFLORES OVALO LIMA");
    expect(deliveryType()).toHaveValue("PUNTO_EXTERNO");
    expect(field(/método de envío/i).getByRole("combobox")).toHaveValue("Shalom");
    await user.click(submitButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(postedOrder()).toEqual(expect.objectContaining({
      deliveryType: "PUNTO_EXTERNO", courier: "Shalom", delivery: { agency: "Shalom — MIRAFLORES OVALO" },
    }));
  }, 20000);

  it("«Ver todas las agencias» deja elegir una agencia fuera de la ubicación del cliente", async () => {
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "PUNTO_EXTERNO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    const agency = field(/^agencia$/i).getByRole("combobox");
    await within(agency).findByRole("option", { name: /MIRAFLORES CENTRO/ });
    expect(within(agency).queryByRole("option", { name: /CUSCO WANCHAQ/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todas las agencias" }));
    await user.selectOptions(agency, "CUSCO WANCHAQ");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.click(submitButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(postedOrder().delivery).toEqual({ agency: "Shalom — CUSCO WANCHAQ" });
    expect(agencyCalls()).toHaveLength(1);
  }, 20000);

  it("envío a domicilio con Shalom sin elegir agencia se registra como antes, sin entrega propia", async () => {
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "DOMICILIO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.click(submitButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(postedOrder()).toEqual(expect.objectContaining({ deliveryType: "DOMICILIO", courier: "Shalom" }));
    expect(postedOrder()).not.toHaveProperty("delivery");
    expect(toast.warning).not.toHaveBeenCalled();
  }, 20000);

  it("con otro método de envío pide la agencia a mano y no consulta el catálogo de Shalom", async () => {
    http.post.mockResolvedValue({ data: { id: "order-created", payments: [], deliverySnapshot: { type: "AGENCY", agency: "Olva — Sucursal Centro" } } });
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "PUNTO_EXTERNO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "OTROS");
    expect(submitButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Agencia y sucursal de este pedido"), "  Olva — Sucursal Centro ");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.click(submitButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(postedOrder()).toEqual(expect.objectContaining({
      deliveryType: "PUNTO_EXTERNO", courier: "OTROS", delivery: { agency: "Olva — Sucursal Centro" },
    }));
    expect(agencyCalls()).toHaveLength(0);
  }, 20000);

  it("cambiar de método de envío descarta la agencia Shalom ya elegida", async () => {
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "PUNTO_EXTERNO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    await chooseShalomAgency(user);
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "OTROS");
    expect(screen.getByLabelText("Agencia y sucursal de este pedido")).toHaveValue("");
    expect(submitButton()).toBeDisabled();
  }, 20000);

  it("avisa si el servidor registró la venta sin guardar la agencia", async () => {
    http.post.mockResolvedValue({ data: { id: "order-created", payments: [], deliverySnapshot: null } });
    mountPage();
    const user = await fillSale();
    await user.selectOptions(deliveryType(), "PUNTO_EXTERNO");
    await user.selectOptions(field(/método de envío/i).getByRole("combobox"), "Shalom");
    await chooseShalomAgency(user);
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.click(submitButton());
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/la agencia de recojo no se guardó/)));
  }, 20000);

  it("un pedido antiguo sin entrega propia no ofrece «Recojo en agencia» al editarlo", async () => {
    mockSearchParams = new URLSearchParams({ orderId: "order-existing" });
    mountPage();
    await screen.findByDisplayValue("Almacén compartido A");
    await waitFor(() => expect(deliveryType()).toHaveValue("RETIRO_TIENDA"));
    const options = within(deliveryType()).getAllByRole("option").map((option) => option.textContent);
    expect(options).not.toContain("Recojo en agencia");
  });
});
