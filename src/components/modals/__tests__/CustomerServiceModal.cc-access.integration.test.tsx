import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { requestSessionToken } from "@/lib/sessionRefresh";
import { tokenStore } from "@/lib/tokenStore";
import axiosAuth from "@/lib/axiosAuth";
import { getCcOrderConfirmationCapabilities, confirmarVentaCc, updateSubEstadoCC, updateDatosClienteCC } from "@/services/atencionClienteService";
import { confirmCommercialOrderPurchase, getCommercialLeadConfirmationCapabilities } from "@/services/commercialLeadsService";
import CustomerServiceModal from "../CustomerServiceModal";
import type { OrderHeader } from "@/interfaces/IOrder";

jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn(async () => ({ id: "company-1", name: "Tienda", stores: [] })),
  fetchCompanyById: jest.fn(),
}));
jest.mock("@/services/fetchUserSubscription", () => ({ fetchUserSubscription: jest.fn(async () => null) }));
jest.mock("@/services/subscriptionAccess", () => ({ fetchSubscriptionAccess: jest.fn(async () => null) }));
jest.mock("@/lib/sessionRefresh", () => ({
  requestSessionToken: jest.fn(), cancelSessionRefresh: jest.fn(),
  registerSessionRefresher: jest.fn(() => () => undefined),
}));
jest.mock("axios", () => ({ __esModule: true, default: { defaults: {}, get: jest.fn(async () => ({ data: [] })), post: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/hooks/useSaleLifecycleRouting", () => ({ useSaleLifecycleRouting: () => async () => false }));
jest.mock("@/utils/printCustomerShippingLabel", () => ({ printCustomerShippingLabel: jest.fn() }));
jest.mock("@/utils/printOrderLabel", () => ({ printOrderLabel: jest.fn() }));
jest.mock("@/utils/downloadNotaVentaPdf", () => ({ downloadNotaVentaPdf: jest.fn() }));
jest.mock("@/hooks/useQrCode", () => ({ useQRCode: () => "" }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleActions", () => ({ SaleUnitLifecycleButtons: () => null }));
jest.mock("@/components/registrar-venta/SaleUnitSelection", () => ({ UnitAssignmentNotice: () => null }));
jest.mock("../CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../AddProductsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../GuideDetailsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../ShalomDocumentModal", () => ({ ShalomDocumentCard: () => null }));
jest.mock("@/app/centro-envios/components/ReassignDeliveryModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../ScheduledDeliverySection", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/CcScriptPanel", () => ({ CcScriptPanel: () => null }));
jest.mock("@/components/orders/OrderEvidenceSection", () => ({ OrderEvidenceSection: () => null }));
jest.mock("@/services/commercialLeadsService", () => ({ getCommercialLeadConfirmationCapabilities: jest.fn(), confirmCommercialOrderPurchase: jest.fn(), commercialLeadError: (error: Error) => error.message }));
jest.mock("@/services/atencionClienteService", () => ({
  getCcOrderConfirmationCapabilities: jest.fn(), confirmarVentaCc: jest.fn(), updateSubEstadoCC: jest.fn(), updateDatosClienteCC: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const UPDATED = "2026-10-22T22:20:00.000Z";
const fixture = (canalOrigen: string | null) => ({
  id: "order-cc-1", orderNumber: "ORD-CC-001", commercialStage: "LEAD", commercialLeadId: "lead-1",
  commercialStockState: "DEFERRED", storeId: "store-1", currency: "PEN", status: "PENDIENTE",
  canalOrigen, subEstadoCc: "por_confirmar", callAttempts: 0, datosCompletos: true, dniCliente: "45678912",
  updated_at: UPDATED, created_at: UPDATED, grandTotal: "79.90", payments: [],
  customer: { id: "customer-1", fullName: "María Pérez", phoneNumber: "999111222", address: "Av. Flores 123", province: "Lima", city: "Lima", district: "Miraflores" },
  items: [{ id: "item-1", productName: "Audífonos", quantity: 1, unitPrice: "79.90", subtotal: "79.90" }],
}) as OrderHeader;

function token(permissions: string[], role = "ADMINISTRADOR") {
  const payload = { id: "admin-1", email: "administrator@example.test", role, permissions,
    companyId: "company-1", iat: 1, exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify(payload))}.fixture`;
}

let session: ReturnType<typeof useAuth>;
function SessionOrder() {
  session = useAuth();
  return session.loading ? <p>Cargando sesión</p> : <CustomerServiceModal open orderId="order-cc-1" onClose={() => undefined} shippingGuide={null} />;
}
const clients: QueryClient[] = [];
function renderOrder(permissions: string[], canalOrigen: string | null = "shopify_cod", role = "ADMINISTRADOR", extra: Partial<OrderHeader> = {}) {
  let currentOrder = { ...fixture(canalOrigen), ...extra };
  jest.mocked(requestSessionToken).mockResolvedValue(token(permissions, role));
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (String(url).endsWith("/order-header/order-cc-1")) return { data: currentOrder };
    if (String(url).endsWith("/log-ventas/order-cc-1")) return { data: [] };
    if (String(url).endsWith("/receipt")) return { data: {
      orderId: currentOrder.id, orderNumber: currentOrder.orderNumber, status: currentOrder.status,
      customer: currentOrder.customer, items: [], payments: [],
      totals: { productsTotal: 79.9, grandTotal: 79.9, taxTotal: 0, shippingTotal: 0, discountTotal: 0, totalPaid: 0, pendingAmount: 79.9 },
    } };
    throw new Error(`Petición inesperada ${String(url)}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><AuthProvider><SessionOrder /></AuthProvider></QueryClientProvider>);
  return { setOrder: (next: Partial<OrderHeader>) => { currentOrder = { ...currentOrder, ...next }; } };
}

beforeEach(() => {
  jest.clearAllMocks(); tokenStore.set(null);
  jest.mocked(getCcOrderConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(confirmCommercialOrderPurchase).mockResolvedValue({ lead: { id: "lead-1" } } as Awaited<ReturnType<typeof confirmCommercialOrderPurchase>>);
  jest.mocked(updateSubEstadoCC).mockResolvedValue({ autoCanceled: false });
  jest.mocked(confirmarVentaCc).mockResolvedValue({ lead: { id: "lead-1" } } as Awaited<ReturnType<typeof confirmarVentaCc>>);
});
afterEach(() => { for (const client of clients.splice(0)) client.clear(); tokenStore.set(null); });

it.each([
  { permissions: ["CONFIRM_SALE"] },
  { permissions: ["CONFIRM_SALE", "CREATE_SALE", "MANAGE_LEADS", "VIEW_CUSTOMER_SERVICE"] },
])("uses the real AuthProvider check with administrator grants %j and no MANAGE_CUSTOMER_SERVICE", async ({ permissions }) => {
  renderOrder(permissions);
  const user = userEvent.setup();
  expect(await screen.findByRole("button", { name: "Confirmar venta" }, { timeout: 5000 })).toBeEnabled();
  expect(session.hasPermission("MANAGE_CUSTOMER_SERVICE")).toBe(false);
  expect(session.hasPermission("CONFIRM_SALE")).toBe(true);
  expect(screen.getByRole("button", { name: "Editar DNI y dirección" })).toBeEnabled();
  expect(screen.getByTitle("Editar Pedido")).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Contactado" }));
  expect(updateSubEstadoCC).toHaveBeenCalledWith("order-cc-1", "contactado", expect.any(String));
  await user.click(await screen.findByRole("button", { name: "Confirmar venta" }, { timeout: 5000 }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar aquí" }));
  await waitFor(() => expect(confirmarVentaCc).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-1", expectedOrderUpdatedAt: UPDATED,
  }));
});

it.each([
  [[], "shopify_cod"],
  [["VIEW_CUSTOMER_SERVICE"], "shopify_cod"],
  [["VIEW_CUSTOMER_SERVICE"], "manual"],
])("does not grant CC management from an admin label with grants %j and channel %s", async (permissions, channel) => {
  renderOrder(permissions, channel);
  expect(await screen.findByText("Necesitas el permiso Confirmar compras para confirmar esta venta.", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(session.auth?.user.role).toBe("ADMINISTRADOR");
  expect(screen.queryByRole("button", { name: "Contactado" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar DNI y dirección" })).not.toBeInTheDocument();
  expect(getCcOrderConfirmationCapabilities).not.toHaveBeenCalled();
});

it("keeps OPERACIONES read-only with VIEW_CUSTOMER_SERVICE and VIEW_SALES but no confirmation or management grant", async () => {
  renderOrder(["VIEW_CUSTOMER_SERVICE", "VIEW_SALES"], "shopify_cod", "OPERACIONES");
  expect(await screen.findByText("Necesitas el permiso Confirmar compras para confirmar esta venta.", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(session.auth?.user.role).toBe("OPERACIONES");
  expect(session.hasPermission("MANAGE_CUSTOMER_SERVICE")).toBe(false);
  expect(session.hasPermission("CONFIRM_SALE")).toBe(false);
  expect(screen.queryByRole("button", { name: "Contactado" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar DNI y dirección" })).not.toBeInTheDocument();
  expect(getCcOrderConfirmationCapabilities).not.toHaveBeenCalled();
});

it("lets a manual sale confirmer complete customer data and confirm through commercial authority without gaining CC actions or full editing", async () => {
  renderOrder(["VIEW_CUSTOMER_SERVICE", "CREATE_SALE", "MANAGE_LEADS", "CONFIRM_SALE"], "manual", "VENTAS");
  const user = userEvent.setup();
  expect(await screen.findByRole("button", { name: "Confirmar venta" }, { timeout: 5000 })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Editar DNI y dirección" })).toBeEnabled();
  expect(screen.getByTitle("Editar Pedido")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Contactado" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar despacho" })).not.toBeInTheDocument();
  expect(getCommercialLeadConfirmationCapabilities).toHaveBeenCalledTimes(1);
  expect(getCcOrderConfirmationCapabilities).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar aquí" }));
  await waitFor(() => expect(confirmCommercialOrderPurchase).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-1", expectedOrderUpdatedAt: UPDATED,
  }));
  expect(confirmarVentaCc).not.toHaveBeenCalled();
  expect(updateSubEstadoCC).not.toHaveBeenCalled();
});

it("keeps manual confirmation and customer completion closed when the server denies confirmation", async () => {
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: false });
  renderOrder(["VIEW_CUSTOMER_SERVICE", "CONFIRM_SALE"], "manual", "VENTAS");
  expect(await screen.findByText("Necesitas el permiso Confirmar compras para confirmar esta venta.", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(getCommercialLeadConfirmationCapabilities).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar DNI y dirección" })).not.toBeInTheDocument();
  expect(screen.getByTitle("Editar Pedido")).toBeDisabled();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("allows an explicit order editor to edit customer data while keeping commercial confirmation separate", async () => {
  renderOrder(["VIEW_CUSTOMER_SERVICE", "EDIT_SALE"], "manual", "VENTAS");
  expect(await screen.findByText("Necesitas el permiso Confirmar compras para confirmar esta venta.", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Editar DNI y dirección" })).toBeEnabled();
  expect(screen.getByTitle("Editar Pedido")).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(getCommercialLeadConfirmationCapabilities).not.toHaveBeenCalled();
  expect(getCcOrderConfirmationCapabilities).not.toHaveBeenCalled();
});

it("lets a seller complete the missing DNI and confirm the same legacy manual CC order after reloading its revision", async () => {
  const { setOrder } = renderOrder(
    ["CONFIRM_SALE", "CREATE_SALE", "MANAGE_CLIENTS", "MANAGE_LEADS", "VIEW_CUSTOMER_SERVICE", "VIEW_LEADS", "VIEW_SALES"],
    "manual", "VENTAS", {
      commercialStage: null, commercialLeadId: null, commercialStockState: null,
      externalSource: null, subEstadoCc: "entrega_lima", stockVersion: 1,
      datosCompletos: false, dniCliente: null,
    },
  );
  const savedRevision = "2026-10-27T15:20:00.000Z";
  jest.mocked(updateDatosClienteCC).mockImplementation(async () => {
    setOrder({ dniCliente: "45678912", datosCompletos: true, updated_at: savedRevision });
    return {} as Awaited<ReturnType<typeof updateDatosClienteCC>>;
  });
  const user = userEvent.setup();
  expect(await screen.findByRole("button", { name: "Confirmar venta" }, { timeout: 5000 })).toBeDisabled();
  expect(screen.getByTitle("Editar Pedido")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Confirmar entrega Lima" })).not.toBeInTheDocument();
  await user.type(screen.getByRole("textbox", { name: "DNI del cliente" }), "45678912");
  await user.click(screen.getByRole("button", { name: "Actualizar Datos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeEnabled());
  expect(updateDatosClienteCC).toHaveBeenCalledWith("order-cc-1", { dniCliente: "45678912" });
  await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar aquí" }));
  await waitFor(() => expect(confirmCommercialOrderPurchase).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), expectedOrderUpdatedAt: savedRevision,
  }));
  expect(jest.mocked(axiosAuth.get).mock.calls.some(([url]) => String(url).endsWith("/receipt"))).toBe(false);
  expect(confirmarVentaCc).not.toHaveBeenCalled();
  expect(updateSubEstadoCC).not.toHaveBeenCalled();
});

it("preserves customer corrections for a CC manager on a confirmed manual order without granting full editing", async () => {
  renderOrder(["MANAGE_CUSTOMER_SERVICE"], "manual", "CALLER", {
    commercialStage: "SALE", commercialLeadId: null, commercialStockState: null, ccConfirmadoAt: UPDATED,
  });
  expect(await screen.findByRole("button", { name: "Editar DNI y dirección" }, { timeout: 5000 })).toBeEnabled();
  expect(screen.getByTitle("Editar Pedido")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(getCommercialLeadConfirmationCapabilities).not.toHaveBeenCalled();
  expect(getCcOrderConfirmationCapabilities).not.toHaveBeenCalled();
});
