import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: jest.requireMock("axios") }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1" }) }));
// Referencia estable: después de una acción, la vista recarga invalidando las consultas del negocio.
const mockInvalidate = jest.fn();
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => mockInvalidate }));
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/ventas",
}));

jest.mock("@/services/atencionClienteService", () => ({
  enviarPedidoALima: jest.fn(),
  reassignSeller: jest.fn(),
}));

jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: () => ({ count: 0, loading: false, error: false, retry: jest.fn(), refetch: jest.fn() }),
}));
// Hoy fijo en 09-26: los pedidos del 09-01 y 09-02 entran en la ventana de 30 días.
jest.mock("@/lib/peruDate", () => ({
  ...jest.requireActual("@/lib/peruDate"),
  todayInPeru: () => "2026-09-26",
}));

jest.mock("@/utils/bulk-receipt-printer", () => ({
  ...jest.requireActual("@/utils/bulk-receipt-printer"),
  buildReceiptsDocument: jest.fn(async () => "<!DOCTYPE html><html><body>ETIQUETAS</body></html>"),
}));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/ImportSalesModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CreateGuideModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CancellationModal", () => ({
  __esModule: true,
  default: ({ open, onConfirm }: { open: boolean; onConfirm: (reason: string, notes: string) => void }) => open ? <button onClick={() => onConfirm("OTHER", "Cliente canceló")}>Confirmar anulación normal</button> : null,
}));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({
  __esModule: true,
  default: ({ action, orderId }: { action: string; orderId: string }) => <div data-testid="lifecycle-flow">{action}:{orderId}</div>,
}));
jest.mock("@/components/ventas/StatusSelect", () => ({
  StatusSelect: ({ status, onStatusChange }: { status: string; onStatusChange: (status: string) => void }) => <button onClick={() => onStatusChange("ANULADO")}>Anular {status}</button>,
}));
jest.mock("@/components/modals/ReassignSellerModal", () => ({
  __esModule: true,
  default: () => null,
}));

import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import type { OrderHeader } from "@/interfaces/IOrder";
import VentasPage from "../page";

const mockedAxios = axios as unknown as { get: jest.Mock; patch: jest.Mock; post: jest.Mock };
const mockUseAuth = jest.mocked(useAuth);
const mockUseOrdersByStore = jest.mocked(useBusinessOrders);
const refetch = jest.fn();

process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";

function makeOrder(id: string, orderNumber: string, createdAt: string): OrderHeader {
  return {
    id,
    receiptType: "BOLETA",
    orderType: "VENTA",
    orderNumber,
    storeId: "store-1",
    customer: {
      id: `client-${id}`,
      companyId: "company-1",
      fullName: `Cliente ${orderNumber}`,
      phoneNumber: "999111222",
      clientType: "TRADICIONAL",
      province: "Lima",
      city: "Lima",
      district: "Miraflores",
      address: "Av. Test 123",
      isActive: true,
    },
    salesChannel: "WHATSAPP",
    closingChannel: "WHATSAPP",
    deliveryType: "DOMICILIO",
    courierId: null,
    courier: null,
    subtotal: "100.00",
    taxTotal: "0.00",
    shippingTotal: "0.00",
    discountTotal: "0.00",
    grandTotal: "100.00",
    status: "PENDIENTE",
    salesRegion: "LIMA",
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [],
    created_at: createdAt,
    updated_at: createdAt,
  } as OrderHeader;
}

const ORDERS = [
  makeOrder("o-1", "ORD-001", "2026-09-01T10:00:00.000Z"),
  makeOrder("o-2", "ORD-002", "2026-09-02T10:00:00.000Z"),
];

let openSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "Vendedora", email: "ana@powip.com", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
      accessToken: "fake-token",
      subscription: null,
      exp: 9999999999,
    },
    loading: false,
    selectedStoreId: "store-1",
    hasPermission: jest.fn().mockReturnValue(true),
  } as unknown as ReturnType<typeof useAuth>);
  mockUseOrdersByStore.mockReturnValue({
    orders: ORDERS,
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch,
  } as unknown as ReturnType<typeof useBusinessOrders>);
  mockedAxios.get.mockImplementation(async (url: string) => {
    const match = url.match(/order-header\/(?:manual\/)?(.+)\/receipt$/);
    if (match) {
      return { data: { orderId: match[1], orderNumber: match[1], customer: { fullName: "x" } } };
    }
    return { data: [] };
  });
  mockedAxios.patch.mockResolvedValue({ data: {} });
  openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  openSpy.mockRestore();
});

const CONFIRM_STEP = { name: "Confirmar cambio de estado" };

async function confirmStep() {
  await screen.findByRole("region", CONFIRM_STEP);
  return screen.getByRole("dialog");
}

async function openPreviewForAllPendientes() {
  const view = render(<VentasPage />);
  await screen.findByText("ORD-001");
  const pendientesPanel = screen.getByRole("tabpanel");
  fireEvent.click(within(pendientesPanel).getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: /Imprimir seleccionados \(2\)/ }));
  const dialog = await screen.findByRole("dialog");
  const frame = (await within(dialog).findByTitle("Vista previa de etiquetas")) as HTMLIFrameElement;
  fireEvent.load(frame);
  const frameWindow = frame.contentWindow as Window;
  jest.spyOn(frameWindow, "focus").mockImplementation(() => {});
  const print = jest.spyOn(frameWindow, "print").mockImplementation(() => {});
  const printButton = within(dialog).getByRole("button", { name: /Imprimir \/ Guardar PDF/ });
  await waitFor(() => expect(printButton).toBeEnabled());
  return { dialog, print, printButton, view };
}

describe("VentasPage — imprimir seleccionados en Ventas pendientes", () => {
  it("abre la vista previa en la app sin ventana emergente y en el orden de la tabla", async () => {
    await openPreviewForAllPendientes();

    expect(openSpy).not.toHaveBeenCalled();
    const receiptCalls = mockedAxios.get.mock.calls
      .map(([url]) => url as string)
      .filter((url) => url.endsWith("/receipt"));
    expect(receiptCalls).toEqual([
      "http://ventas/order-header/o-2/receipt",
      "http://ventas/order-header/o-1/receipt",
    ]);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("cerrar la vista previa no cambia estados", async () => {
    const { dialog } = await openPreviewForAllPendientes();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("imprimir y cancelar la confirmación no cambia estados", async () => {
    const { print, printButton, dialog } = await openPreviewForAllPendientes();

    fireEvent.click(printButton);
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Volver",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("solo la confirmación explícita pasa los pedidos seleccionados a PREPARADO", async () => {
    const { printButton } = await openPreviewForAllPendientes();

    fireEvent.click(printButton);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();

    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Sí, marcar como PREPARADO",
      }),
    );

    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledTimes(2));
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "http://ventas/order-header/o-2",
      expect.objectContaining({ status: "PREPARADO", userId: "user-1" }),
    );
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "http://ventas/order-header/o-1",
      expect.objectContaining({ status: "PREPARADO", userId: "user-1" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockInvalidate).toHaveBeenCalled();
    // Una sola recarga: la invalidación ya refresca cada consulta activa de la vista
    expect(refetch).not.toHaveBeenCalled();
  });
});


it("blocks preparation/label printing for a selected sale whose units are still pending", async () => {
  const prior = mockUseOrdersByStore.getMockImplementation()!();
  mockUseOrdersByStore.mockReturnValue({ ...prior, orders: ORDERS.map((order) => ({ ...order, unitAssignmentStatus: "PENDING", unitCatalogValidated: true, stockVersion: 2, confirmedStockVersion: null })) });
  render(<VentasPage />);
  await screen.findByText("ORD-001");
  fireEvent.click(within(screen.getByRole("tabpanel")).getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: /Imprimir seleccionados \(2\)/ }));
  expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/pendiente de confirmación/));
  expect(screen.queryByTitle("Vista previa de etiquetas")).not.toBeInTheDocument();
  expect(mockedAxios.patch).not.toHaveBeenCalled();
});

it("confirmed tracked preparation uses the authenticated status route", async () => {
  const prior = mockUseOrdersByStore.getMockImplementation()!();
  mockUseOrdersByStore.mockReturnValue({ ...prior, orders: ORDERS.map((order) => ({ ...order, unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true, stockVersion: 2, confirmedStockVersion: 2 })) });
  const { printButton } = await openPreviewForAllPendientes();
  expect(mockedAxios.get).toHaveBeenCalledWith("http://ventas/order-header/manual/o-1/receipt");
  expect(mockedAxios.get).toHaveBeenCalledWith("http://ventas/order-header/manual/o-2/receipt");
  fireEvent.click(printButton);
  fireEvent.click(within(await confirmStep()).getByRole("button", { name: "Sí, marcar como PREPARADO" }));
  await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledTimes(2));
  expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/manual/o-1/status", expect.objectContaining({ status: "PREPARADO" }));
  expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/manual/o-2/status", expect.objectContaining({ status: "PREPARADO" }));
});

it.each(['company', 'user'])('hides an existing private print preview when %s changes', async (changed) => {
  const { view } = await openPreviewForAllPendientes();
  const prior = mockUseAuth.getMockImplementation()!();
  const company = prior.auth?.company;
  if (!company) throw new Error("The authenticated fixture requires a company");
  mockUseAuth.mockReturnValue({ ...prior, auth: { ...prior.auth!,
    company: { ...company, id: changed === 'company' ? 'company-2' : 'company-1' },
    user: { ...prior.auth!.user, id: changed === 'user' ? 'user-2' : 'user-1' },
  } });
  view.rerender(<VentasPage />);
  expect(screen.queryByTitle('Vista previa de etiquetas')).not.toBeInTheDocument();
  expect(mockedAxios.patch).not.toHaveBeenCalled();
});


describe("Ventas — anulación de pedido en envío", () => {
  async function cancelInTransit(unitAssignmentStatus: "CONFIRMED" | "NONE") {
    const order = { ...ORDERS[0], status: "EN_ENVIO" as const, unitAssignmentStatus, unitCatalogValidated: true, stockVersion: 1, confirmedStockVersion: 1 };
    mockUseOrdersByStore.mockReturnValue({ orders: [order], loading: false, error: false, retry: jest.fn(), refetch } as unknown as ReturnType<typeof useBusinessOrders>);
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas/i }), { button: 0, ctrlKey: false });
    const cancel = await screen.findByRole("button", { name: "Anular EN_ENVIO" });
    await act(async () => { fireEvent.click(cancel); });
  }
  test("tracked order opens physical return and cannot be cancelled by a generic patch", async () => {
    await cancelInTransit("CONFIRMED");
    expect(await screen.findByTestId("lifecycle-flow")).toHaveTextContent("return:o-1");
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar anulación normal" })).not.toBeInTheDocument();
  });
  test("NONE retains its existing cancellation path", async () => {
    await cancelInTransit("NONE");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar anulación normal" }));
    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/o-1", expect.objectContaining({ status: "ANULADO", cancellationReason: "OTHER", notes: "Cliente canceló" })));
    expect(screen.queryByTestId("lifecycle-flow")).not.toBeInTheDocument();
  });
});
