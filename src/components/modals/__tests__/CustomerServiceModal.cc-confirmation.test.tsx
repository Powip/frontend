import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustomerServiceModal from "../CustomerServiceModal";
import { useAuth } from "@/contexts/AuthContext";
import { useSaleLifecycleRouting } from "@/hooks/useSaleLifecycleRouting";
import axiosAuth from "@/lib/axiosAuth";
import axios from "axios";
import {
  confirmCommercialOrderPurchase,
  getCommercialLeadConfirmationCapabilities,
} from "@/services/commercialLeadsService";
import {
  updateDatosClienteCC,
  updateSubEstadoCC,
  getCcOrderConfirmationCapabilities,
  confirmarVentaCc,
} from "@/services/atencionClienteService";
import PaymentVerificationModal from "../PaymentVerificationModal";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { LeadConfirmationResponse } from "@/types/leads";


jest.mock("@/hooks/useSaleLifecycleRouting", () => ({ useSaleLifecycleRouting: jest.fn(() => async () => false) }));
jest.mock("@/hooks/useReceiptPrintScope", () => ({ useReceiptPrintScope: () => () => undefined }));
jest.mock("@/utils/printCustomerShippingLabel", () => ({ printCustomerShippingLabel: jest.fn() }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({ __esModule: true, default: ({ open, action, orderId }: { open: boolean; action: string; orderId: string }) => open ? <div data-testid="cc-unit-lifecycle">{action} · {orderId}</div> : null }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleActions", () => ({ SaleUnitLifecycleButtons: () => null }));
jest.mock("@/components/registrar-venta/SaleUnitSelection", () => ({ UnitAssignmentNotice: () => null }));

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("@/services/commercialLeadsService", () => ({
  confirmCommercialOrderPurchase: jest.fn(),
  getCommercialLeadConfirmationCapabilities: jest.fn(),
  commercialLeadError: (error: unknown) => error instanceof Error ? error.message : "Error de confirmación",
}));
jest.mock("@/services/atencionClienteService", () => ({
  updateDatosClienteCC: jest.fn(),
  updateSubEstadoCC: jest.fn(),
  getCcOrderConfirmationCapabilities: jest.fn(),
  confirmarVentaCc: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/hooks/useQrCode", () => ({ useQRCode: () => "" }));
jest.mock("@/utils/printOrderLabel", () => ({ printOrderLabel: jest.fn() }));
jest.mock("@/utils/downloadNotaVentaPdf", () => ({ downloadNotaVentaPdf: jest.fn() }));
jest.mock("../CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../AddProductsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../PaymentVerificationModal", () => ({
  __esModule: true,
  default: jest.fn(({ open, orderId, orderNumber }: { open: boolean; orderId: string; orderNumber: string }) =>
    open ? <div data-testid="cc-payment-modal">Pagos de {orderNumber} · {orderId}</div> : null),
}));
jest.mock("../GuideDetailsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../ShalomDocumentModal", () => ({ ShalomDocumentCard: () => null }));
jest.mock("@/app/centro-envios/components/ReassignDeliveryModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../ScheduledDeliverySection", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/CcScriptPanel", () => ({ CcScriptPanel: () => null }));
jest.mock("@/components/orders/OrderEvidenceSection", () => ({ OrderEvidenceSection: () => null }));


function authSession(session: ReturnType<typeof useAuth>) {
  return { ...session, hasPermission: (permission: string) => session.auth?.user.permissions?.includes(permission) ?? false };
}

const ORDER_UPDATED_AT = "2026-10-22T22:20:00.000Z";
const SAVED_UPDATED_AT = "2026-10-22T22:21:00.000Z";
const clients: QueryClient[] = [];
let currentOrder: OrderHeader;

function order(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-cc-1",
    commercialStage: "LEAD",
    commercialLeadId: "lead-cc-1",
    commercialStockState: "DEFERRED",
    orderNumber: "ORD-CC-001",
    storeId: "store-1",
    currency: "PEN",
    grandTotal: "79.90",
    datosCompletos: true,
    dniCliente: "45678912",
    updated_at: ORDER_UPDATED_AT,
    customer: {
      id: "customer-1",
      fullName: "María Pérez",
      phoneNumber: "999111222",
      province: "Lima",
      city: "Lima",
      district: "Miraflores",
      address: "Av. Flores 123",
    },
    items: [{ id: "item-1", quantity: 1, productName: "Audífonos Bluetooth", subtotal: "79.90" }],
    payments: [],
    ...overrides,
  } as OrderHeader;
}

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const onOrderUpdated = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <CustomerServiceModal open orderId="order-cc-1" onClose={jest.fn()} onOrderUpdated={onOrderUpdated} shippingGuide={null} />
    </QueryClientProvider>,
  );
  return { onOrderUpdated };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSaleLifecycleRouting).mockReturnValue(async () => false);
  currentOrder = order();
  jest.mocked(useAuth).mockReturnValue(authSession({
    auth: {
      company: { id: "company-1", stores: [] },
      user: {
        id: "cc-user-1", name: "Ana", authorizationVerified: true,
        authorizationCompanyId: "company-1", permissions: ["MANAGE_CUSTOMER_SERVICE", "CONFIRM_SALE"],
      },
    },
  } as unknown as ReturnType<typeof useAuth>));
  jest.mocked(axios.get).mockResolvedValue({ data: [] });
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (String(url).endsWith("/order-header/order-cc-1")) return { data: currentOrder };
    if (String(url).endsWith("/log-ventas/order-cc-1")) return { data: [] };
    throw new Error(`Petición inesperada: ${String(url)}`);
  });
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
  jest.mocked(getCcOrderConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(confirmarVentaCc).mockResolvedValue({
    lead: { id: "lead-cc-1" }, order: { id: "order-cc-1", commercialStage: "SALE" }, replayed: false,
  } as LeadConfirmationResponse);
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(confirmCommercialOrderPurchase).mockResolvedValue({
    lead: { id: "lead-cc-1" }, order: { id: "order-cc-1", commercialStage: "SALE" }, replayed: false,
  } as LeadConfirmationResponse);
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

it("reviews and confirms the Lead from CC without requesting a sale receipt", async () => {
  const { onOrderUpdated } = renderModal();
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Confirmar venta" }));
  expect(screen.getByText("María Pérez")).toBeInTheDocument();
  expect(screen.getByText("1 × Audífonos Bluetooth")).toBeInTheDocument();
  expect(screen.getByText("Total: PEN 79.90")).toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));

  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(1));
  expect(confirmCommercialOrderPurchase).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-cc-1", expectedOrderUpdatedAt: ORDER_UPDATED_AT,
  });
  expect(jest.mocked(axiosAuth.get).mock.calls.every(([url]) => !String(url).endsWith("/receipt"))).toBe(true);
});

it("saves the missing DNI and confirms only after reloading the updated order", async () => {
  currentOrder = order({ dniCliente: null, datosCompletos: false });
  jest.mocked(updateDatosClienteCC).mockImplementation(async () => {
    currentOrder = order({ dniCliente: "45678912", datosCompletos: true, updated_at: SAVED_UPDATED_AT });
    return currentOrder;
  });
  const { onOrderUpdated } = renderModal();
  const user = userEvent.setup();

  expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeDisabled();
  await user.type(screen.getByRole("textbox", { name: "DNI del cliente" }), "45678912");
  await user.click(screen.getByRole("button", { name: "Actualizar Datos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeEnabled());
  expect(updateDatosClienteCC).toHaveBeenCalledWith("order-cc-1", { dniCliente: "45678912" });
  await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));

  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(2));
  expect(confirmCommercialOrderPurchase).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-cc-1", expectedOrderUpdatedAt: SAVED_UPDATED_AT,
  });
  expect(jest.mocked(axiosAuth.get).mock.calls.every(([url]) => !String(url).endsWith("/receipt"))).toBe(true);
});

it("shows a readonly Lead without CC editor or confirmation action", async () => {
  jest.mocked(useAuth).mockReturnValue(authSession({
    auth: {
      company: { id: "company-1", stores: [] },
      user: { id: "reader-1", authorizationVerified: true, authorizationCompanyId: "company-1", permissions: ["VIEW_CUSTOMER_SERVICE"] },
    },
  } as unknown as ReturnType<typeof useAuth>));
  currentOrder = order({ dniCliente: null, datosCompletos: false });
  renderModal();

  expect(await screen.findByText("Tu rol no permite confirmar ventas.")).toBeInTheDocument();
  expect(screen.getByText("1 × Audífonos Bluetooth")).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "DNI del cliente" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(updateDatosClienteCC).not.toHaveBeenCalled();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
  expect(getCommercialLeadConfirmationCapabilities).not.toHaveBeenCalled();
});

it("keeps Shopify COD contacts and purchase confirmation in CC for a CC operator", async () => {
  jest.mocked(useAuth).mockReturnValue(authSession({
    auth: {
      company: { id: "company-1", stores: [] },
      user: {
        id: "cc-user-1", name: "Ana", authorizationVerified: true,
        authorizationCompanyId: "company-1", permissions: ["MANAGE_CUSTOMER_SERVICE"],
      },
    },
  } as unknown as ReturnType<typeof useAuth>));
  currentOrder = order({ canalOrigen: "shopify_cod", subEstadoCc: "por_confirmar", callAttempts: 0 });
  jest.mocked(updateSubEstadoCC).mockImplementation(async (_orderId, subEstadoCc) => {
    currentOrder = { ...currentOrder, subEstadoCc, updated_at: SAVED_UPDATED_AT };
    return { autoCanceled: false };
  });
  const { onOrderUpdated } = renderModal();
  const user = userEvent.setup();

  expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeEnabled();
  expect(getCcOrderConfirmationCapabilities).toHaveBeenCalledWith("order-cc-1");
  expect(getCommercialLeadConfirmationCapabilities).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Lead/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Contactado" }));
  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(1));
  await user.click(await screen.findByRole("button", { name: "No contesta (1/3)" }));
  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(2));
  expect(updateSubEstadoCC).toHaveBeenNthCalledWith(1, "order-cc-1", "contactado", expect.any(String));
  expect(updateSubEstadoCC).toHaveBeenNthCalledWith(2, "order-cc-1", "no_contesta", expect.any(String));
  await user.click(await screen.findByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));

  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(3));
  expect(confirmarVentaCc).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-cc-1", expectedOrderUpdatedAt: SAVED_UPDATED_AT,
  });
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
  expect(jest.mocked(axiosAuth.get).mock.calls.every(([url]) => !String(url).endsWith("/receipt"))).toBe(true);
});

it("opens the same Shopify COD order payments from its CC detail without approving or redirecting", async () => {
  currentOrder = order({ canalOrigen: "shopify_cod", subEstadoCc: "por_confirmar" });
  renderModal();
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Gestionar adelantos y comprobantes" }));
  expect(screen.getByTestId("cc-payment-modal")).toHaveTextContent("ORD-CC-001 · order-cc-1");
  expect(jest.mocked(PaymentVerificationModal).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
    open: true, orderId: "order-cc-1", orderNumber: "ORD-CC-001", canApprove: false,
  }));
  expect(screen.queryByRole("link", { name: /Lead/i })).not.toBeInTheDocument();
});

it("saves the CC history comment with the authenticated client while a Shopify COD purchase is pending", async () => {
  currentOrder = order({ canalOrigen: "shopify_cod", subEstadoCc: "por_confirmar" });
  renderModal();
  const user = userEvent.setup();

  await user.type(await screen.findByRole("textbox", { name: "Comentario de Gestión CC" }), "Cliente confirma contacto por WhatsApp");
  await user.click(screen.getByRole("button", { name: "Guardar comentario" }));
  await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledTimes(1));
  expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/log-ventas$/), expect.objectContaining({
    orderId: "order-cc-1", comentarios: "Cliente confirma contacto por WhatsApp", operacion: "COMMENT",
  }));
  expect(axios.post).not.toHaveBeenCalled();
});

it("combines editing an imported DNI, keeping an advance with proof and confirming the same Shopify COD order in CC", async () => {
  currentOrder = order({ canalOrigen: "shopify_cod", subEstadoCc: "por_confirmar" });
  jest.mocked(updateDatosClienteCC).mockImplementation(async (_id, data) => {
    currentOrder = {
      ...currentOrder,
      dniCliente: data.dniCliente ?? null,
      updated_at: SAVED_UPDATED_AT,
    };
    return currentOrder;
  });
  const { onOrderUpdated } = renderModal();
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Editar DNI y dirección" }));
  await user.clear(screen.getByRole("textbox", { name: "DNI del cliente" }));
  await user.type(screen.getByRole("textbox", { name: "DNI del cliente" }), "46789123");
  await user.click(screen.getByRole("button", { name: "Actualizar Datos" }));
  await waitFor(() => expect(onOrderUpdated).toHaveBeenCalledTimes(1));
  expect(updateDatosClienteCC).toHaveBeenCalledWith("order-cc-1", {
    dniCliente: "46789123", province: "Lima", city: "Lima",
    district: "Miraflores", address: "Av. Flores 123",
  });

  await user.click(await screen.findByRole("button", { name: "Gestionar adelantos y comprobantes" }));
  const paymentProps = jest.mocked(PaymentVerificationModal).mock.calls.at(-1)![0];
  const paymentTimestamp = "2026-10-22T22:22:00.000Z";
  currentOrder = {
    ...currentOrder,
    updated_at: paymentTimestamp,
    payments: [{
      id: "advance-cc-1", amount: "20.00", paymentMethod: "TRANSFERENCIA",
      status: "PENDING", paymentProofUrl: "https://example.test/advance-cc-1.pdf",
    }] as OrderHeader["payments"],
  };
  await act(async () => {
    paymentProps.onPaymentUpdated?.();
    paymentProps.onClose();
  });
  expect(await screen.findByText("Adelantos y pagos registrados: 1")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: "El cliente aceptó los productos y el total del pedido" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));

  await waitFor(() => expect(confirmarVentaCc).toHaveBeenCalledWith("order-cc-1", {
    commandId: expect.any(String), leadId: "lead-cc-1", expectedOrderUpdatedAt: paymentTimestamp,
  }));
  expect(currentOrder.dniCliente).toBe("46789123");
  expect(currentOrder.payments).toEqual([expect.objectContaining({
    id: "advance-cc-1", status: "PENDING", paymentProofUrl: "https://example.test/advance-cc-1.pdf",
  })]);
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Lead/i })).not.toBeInTheDocument();
});

it("keeps the current unit return modal reachable before cancelling a historical COD Lead with physical stock", async () => {
  currentOrder = order({ canalOrigen: "shopify_cod", subEstadoCc: "por_confirmar", commercialStockState: "PRESERVED" });
  jest.mocked(useSaleLifecycleRouting).mockReturnValue(async (_order, _target, onTracked) => {
    onTracked("return");
    return true;
  });
  renderModal();
  await userEvent.click(await screen.findByRole("button", { name: "Anular pedido" }));
  expect(await screen.findByTestId("cc-unit-lifecycle")).toHaveTextContent("return · order-cc-1");
  expect(updateSubEstadoCC).not.toHaveBeenCalled();
});
